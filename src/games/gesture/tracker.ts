/**
 * 手势追踪器：懒加载 MediaPipe tasks-vision（动态 import，独立 chunk），
 * 用 OffscreenCanvas 把视频降到 480×360 再送检测，降低每帧开销。
 *
 * 检测与渲染解耦：调用方按自己的节奏调用 detect()，内部做时间节流。
 */
import type { Landmark } from "./math";

export type TrackerStatus = "idle" | "loading-runtime" | "loading-model" | "ready" | "error";

export interface TrackerProgress {
  status: TrackerStatus;
  loaded: number;
  total: number;
  message?: string;
}

export interface HandObservation {
  landmarks: Landmark[];
  /** 归一化到摄像头画面的坐标 */
  handedness: string;
  score: number;
}

/** 运行时诊断：用来看"检测到底跑没跑"，别让失败静默。 */
export interface TrackerStats {
  /** 实际执行的 detectForVideo 次数 */
  detectCalls: number;
  /** detect 抛异常次数 */
  errors: number;
  /** 最近一次异常信息 */
  lastError: string;
  /** 最近一次成功检测的时间戳 */
  lastRunAt: number;
  /** 连续多少帧没识别到手 */
  emptyFrames: number;
  /** 最近一次跳过检测的原因（节流不算） */
  skipReason: string;
  /** 实际使用的 delegate */
  delegate: string;
}

type HandLandmarker = {
  detectForVideo: (image: HTMLCanvasElement | HTMLVideoElement, ts: number) => {
    landmarks: Landmark[][];
    handedness?: { categoryName: string; score: number }[][];
    handednesses?: { categoryName: string; score: number }[][];
  };
  close: () => void;
  setOptions: (o: unknown) => Promise<void>;
};

type HandLandmarkerModule = {
  FilesetResolver: {
    forVisionTasks: (basePath: string) => Promise<unknown>;
  };
  HandLandmarker: {
    createFromOptions: (fileset: unknown, options: unknown) => Promise<HandLandmarker>;
  };
};

const VERSION = "1.2.2";
const WASM_BASE = `${import.meta.env.BASE_URL}mediapipe/${VERSION}/wasm`;
const MODEL_URL = `${import.meta.env.BASE_URL}mediapipe/${VERSION}/models/hand_landmarker.task`;

/** 检测输入尺寸：480×360 对 21 点识别已经足够，比 640×480 快约 1.7 倍。 */
const DETECT_W = 480;
const DETECT_H = 360;
/** 检测最高 30fps，游戏渲染 60fps 不受影响。 */
const DETECT_INTERVAL_MS = 33;

export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private lastDetect = 0;
  private lastResult: HandObservation[] = [];
  private disposed = false;
  private busy = false;
  /** 保留给「GPU 静默失败 → 切 CPU」重建使用 */
  private module: HandLandmarkerModule | null = null;
  private fileset: unknown = null;
  private fallbackTried = false;
  /** 运行时诊断，由 detect() 持续更新，供 UI 排查用 */
  private meta: TrackerStats = {
    detectCalls: 0,
    errors: 0,
    lastError: "",
    lastRunAt: 0,
    emptyFrames: 0,
    skipReason: "not-ready",
    delegate: "-",
  };
  numHands: number;

  constructor(numHands = 1) {
    this.numHands = numHands;
  }

  get ready() {
    return !!this.landmarker;
  }

  /**
   * 加载运行时 + 模型。模型约 7.5MB，首次加载会明显等待，调用方应展示进度。
   * GPU 委托在部分机型/浏览器上会静默产出空结果或直接失败，这里失败自动回退 CPU。
   */
  async load(onProgress?: (p: TrackerProgress) => void): Promise<void> {
    if (this.landmarker) return;
    onProgress?.({ status: "loading-runtime", loaded: 0, total: 2 });

    const mod = (await import("@mediapipe/tasks-vision")) as unknown as HandLandmarkerModule;
    if (this.disposed) return;

    onProgress?.({ status: "loading-model", loaded: 0, total: 1 });
    const fileset = await mod.FilesetResolver.forVisionTasks(WASM_BASE);
    if (this.disposed) return;

    const build = (delegate: "GPU" | "CPU") =>
      mod.HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: "VIDEO",
        numHands: this.numHands,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

    let delegate: "GPU" | "CPU" = "GPU";
    try {
      this.landmarker = await build("GPU");
    } catch (err) {
      // GPU 初始化失败（缺 WebGL2 / 显存不足 / 老机型）→ 回退 CPU，功能不变只是慢一些
      this.meta.lastError = `GPU 初始化失败，已回退 CPU：${(err as Error)?.message ?? err}`;
      delegate = "CPU";
      this.landmarker = await build("CPU");
    }
    if (this.disposed) return;
    this.meta.delegate = delegate;
    this.fileset = fileset;
    this.module = mod;

    this.canvas = document.createElement("canvas");
    this.canvas.width = DETECT_W;
    this.canvas.height = DETECT_H;
    this.ctx = this.canvas.getContext("2d", { alpha: false });
    onProgress?.({ status: "ready", loaded: 1, total: 1 });
  }

  /**
   * 连续约 3 秒检测到 0 只手，且当前用的是 GPU → 静默降级到 CPU 重建一次。
   * 某些机型上 GPU 委托不报错但恒返回空结果，这是唯一能自愈的线索。
   */
  private maybeFallbackToCpu() {
    if (this.meta.delegate !== "GPU" || !this.module || !this.fileset) return;
    if (this.meta.emptyFrames < 90) return;
    if (this.fallbackTried) return;
    this.fallbackTried = true;
    const mod = this.module;
    const fileset = this.fileset;
    const numHands = this.numHands;
    void (async () => {
      try {
        const next = await mod.HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
          runningMode: "VIDEO",
          numHands,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        const old = this.landmarker;
        this.landmarker = next;
        this.meta.delegate = "CPU";
        this.meta.emptyFrames = 0;
        this.meta.lastError = "GPU 连续识别不到手，已自动切换到 CPU";
        try {
          old?.close();
        } catch {
          // 关闭旧实例失败无妨，后续会被 GC
        }
      } catch (err) {
        this.meta.lastError = `切换 CPU 失败：${(err as Error)?.message ?? err}`;
      }
    })();
  }

  /** GPU delegate 失败时（部分机型）回退到 CPU，不阻断使用。 */
  async setNumHands(n: number) {
    this.numHands = n;
    if (!this.landmarker) return;
    try {
      await this.landmarker.setOptions({ numHands: n });
    } catch {
      // 老版本不支持 setOptions 时忽略，下次重建才生效
    }
  }

  /**
   * 同步检测一帧。内部按 30fps 节流，且避免重入（同一帧未完成时跳过）。
   * 返回最近一次结果，保证调用方每帧都能拿到可用数据。
   */
  detect(video: HTMLVideoElement, now = performance.now()): HandObservation[] {
    if (!this.landmarker || !this.ctx || !this.canvas) {
      this.stats.skipReason = "not-ready";
      return this.lastResult;
    }
    if (this.busy) {
      this.stats.skipReason = "busy";
      return this.lastResult;
    }
    if (now - this.lastDetect < DETECT_INTERVAL_MS) return this.lastResult;
    if (video.readyState < 2 || video.videoWidth === 0) {
      this.stats.skipReason = "video-not-ready";
      return this.lastResult;
    }

    this.lastDetect = now;
    this.busy = true;
    try {
      this.ctx.drawImage(video, 0, 0, DETECT_W, DETECT_H);
      const res = this.landmarker.detectForVideo(this.canvas, now);
      this.stats.detectCalls += 1;
      this.stats.lastRunAt = now;
      this.stats.skipReason = "";
      this.stats.lastError = "";
      const hands: HandObservation[] = [];
      const handed = res.handedness ?? res.handednesses ?? [];
      for (let i = 0; i < res.landmarks.length; i += 1) {
        const cat = handed[i]?.[0];
        hands.push({
          landmarks: res.landmarks[i],
          handedness: cat?.categoryName ?? "Unknown",
          score: cat?.score ?? 0,
        });
      }
      this.lastResult = hands;
      this.stats.emptyFrames = hands.length === 0 ? this.stats.emptyFrames + 1 : 0;
      if (hands.length === 0) this.maybeFallbackToCpu();
      return hands;
    } catch (err) {
      // 之前这里静默吞掉异常，导致"看不到骨架也没有任何提示"，无法定位问题所在
      this.stats.lastError = (err as Error)?.message || String(err);
      this.stats.errors += 1;
      return this.lastResult;
    } finally {
      this.busy = false;
    }
  }

  /** 诊断信息：实验室与游戏页都会展示，用于区分"模型没跑"和"跑但没识别到"。 */
  get stats(): TrackerStats {
    return this.meta;
  }

  /** 视频实际分辨率，用于判断相机是否真的出画面（0×0 说明流没起来）。 */
  describeVideo(video: HTMLVideoElement | null): string {
    if (!video) return "无视频元素";
    return `${video.videoWidth}×${video.videoHeight} / readyState=${video.readyState}`;
  }

  /** 最近一次结果。 */
  get latest(): HandObservation[] {
    return this.lastResult;
  }

  /** 手丢失时清空，避免拿旧数据继续操控。 */
  clear() {
    this.lastResult = [];
  }

  dispose() {
    this.disposed = true;
    try {
      this.landmarker?.close();
    } catch {
      // 忽略关闭异常
    }
    this.landmarker = null;
    this.canvas = null;
    this.ctx = null;
    this.lastResult = [];
  }
}

/** 全局单例：多个页面（游戏 / 实验室）共用一份模型，避免重复下载与显存占用。 */
let shared: HandTracker | null = null;

export function getTracker(numHands = 1): HandTracker {
  if (!shared) shared = new HandTracker(numHands);
  return shared;
}

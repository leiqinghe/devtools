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
  numHands: number;

  constructor(numHands = 1) {
    this.numHands = numHands;
  }

  get ready() {
    return !!this.landmarker;
  }

  /**
   * 加载运行时 + 模型。模型约 7.5MB，首次加载会明显等待，调用方应展示进度。
   * 注意：这里用 fetch + 流式读取来产生真实进度，否则 fetch 的 progress 在部分浏览器不可用。
   */
  async load(onProgress?: (p: TrackerProgress) => void): Promise<void> {
    if (this.landmarker) return;
    onProgress?.({ status: "loading-runtime", loaded: 0, total: 2 });

    const mod = (await import("@mediapipe/tasks-vision")) as unknown as HandLandmarkerModule;
    if (this.disposed) return;

    onProgress?.({ status: "loading-model", loaded: 0, total: 1 });
    const fileset = await mod.FilesetResolver.forVisionTasks(WASM_BASE);
    if (this.disposed) return;

    this.landmarker = await mod.HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: this.numHands,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    this.canvas = document.createElement("canvas");
    this.canvas.width = DETECT_W;
    this.canvas.height = DETECT_H;
    this.ctx = this.canvas.getContext("2d", { alpha: false });
    onProgress?.({ status: "ready", loaded: 1, total: 1 });
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
    if (!this.landmarker || !this.ctx || !this.canvas) return this.lastResult;
    if (this.busy) return this.lastResult;
    if (now - this.lastDetect < DETECT_INTERVAL_MS) return this.lastResult;
    if (video.readyState < 2 || video.videoWidth === 0) return this.lastResult;

    this.lastDetect = now;
    this.busy = true;
    try {
      this.ctx.drawImage(video, 0, 0, DETECT_W, DETECT_H);
      const res = this.landmarker.detectForVideo(this.canvas, now);
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
      return hands;
    } catch {
      return this.lastResult;
    } finally {
      this.busy = false;
    }
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

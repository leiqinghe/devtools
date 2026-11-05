/** 摄像头管理：申请权限、选择设备、输出一个可被检测器消费的视频流。 */

export type CameraErrorCode =
  | "insecure"
  | "unsupported"
  | "denied"
  | "notfound"
  | "inuse"
  | "unknown";

export class CameraError extends Error {
  code: CameraErrorCode;
  constructor(code: CameraErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "CameraError";
  }
}

export interface CameraHandle {
  stream: MediaStream;
  video: HTMLVideoElement;
  stop(): void;
  setMirrored(mirrored: boolean): void;
}

/** 摄像头需要 secure context（https 或 localhost）。http 的 IP 入口会失败，提前给出明确提示。 */
export function isSecureContextOk(): boolean {
  if (typeof window === "undefined") return false;
  if (window.isSecureContext) return true;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

export function cameraSupport(): { ok: boolean; reason?: CameraErrorCode; hint?: string } {
  if (!isSecureContextOk()) {
    return {
      ok: false,
      reason: "insecure",
      hint: "摄像头仅在 HTTPS 或 localhost 下可用，请改用 https 域名访问（或先用鼠标/键盘玩）",
    };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, reason: "unsupported", hint: "当前浏览器不支持摄像头，请改用 Chrome / Edge / Safari 新版" };
  }
  return { ok: true };
}

function mapError(err: unknown): CameraError {
  const e = err as { name?: string };
  switch (e?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return new CameraError("denied", "摄像头权限被拒绝，请在浏览器地址栏的权限设置里允许后重试");
    case "NotFoundError":
    case "DevicesNotFoundError":
      return new CameraError("notfound", "没有检测到可用摄像头");
    case "NotReadableError":
    case "TrackStartError":
      return new CameraError("inuse", "摄像头被其他程序占用，请关闭会议软件后重试");
    default:
      return new CameraError("unknown", "摄像头启动失败，请重试");
  }
}

/** 打开摄像头。分辨率请求 640×480（足够识别，又不至于在中端机上过热）。 */
export async function openCamera(deviceId = ""): Promise<CameraHandle> {
  const support = cameraSupport();
  if (!support.ok) throw new CameraError(support.reason ?? "unknown", support.hint ?? "摄像头不可用");

  const constraints: MediaStreamConstraints = {
    audio: false,
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30, max: 30 },
      facingMode: deviceId ? undefined : "user",
      deviceId: deviceId ? { exact: deviceId } : undefined,
    },
  };

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    if (deviceId) {
      // 指定设备失效时退回默认摄像头，不直接让用户卡住
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 }, facingMode: "user" },
        });
      } catch (err2) {
        throw mapError(err2);
      }
    } else {
      throw mapError(err);
    }
  }

  const video = document.createElement("video");
  video.playsInline = true;
  video.muted = true;
  video.autoplay = true;
  video.srcObject = stream;
  await video.play().catch(() => {
    // iOS 偶发 play 被拒，等 metadata 后再试一次
    return new Promise<void>((resolve) => {
      video.onloadedmetadata = () => {
        void video.play().finally(() => resolve());
      };
    });
  });

  return {
    stream,
    video,
    stop() {
      for (const track of stream.getTracks()) track.stop();
      video.srcObject = null;
    },
    setMirrored(mirrored: boolean) {
      video.style.transform = mirrored ? "scaleX(-1)" : "none";
    },
  };
}

/** 列出可用摄像头（设备名称需已授权后才能拿到，未授权时是空字符串）。 */
export async function listCameras(): Promise<{ deviceId: string; label: string }[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === "videoinput")
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `摄像头 ${i + 1}` }));
}

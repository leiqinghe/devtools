import { loadSettings, saveSettings } from "../core/storage";

export interface GestureSettings {
  /** 是否启用双手模式 */
  twoHands: boolean;
  /** 平滑强度：数值越大越平滑（也越迟钝）。0.6~2.5 合适 */
  smoothing: number;
  /** 捏合触发阈值（越小越难捏） */
  pinchEnter: number;
  /** 捏合释放阈值（必须大于 Enter，形成滞回） */
  pinchExit: number;
  /** 握拳暂停的保持时长（毫秒） */
  fistHoldMs: number;
  /** 映射内缩比例，越小越贴近画面边缘 */
  margin: number;
  /** 是否显示摄像头画面 */
  showCamera: boolean;
  /** 是否显示 21 点骨架 */
  showSkeleton: boolean;
  /** 优先使用的摄像头设备 ID（空串 = 默认） */
  deviceId: string;
}

export const GESTURE_DEFAULTS: GestureSettings = {
  twoHands: false,
  smoothing: 1.2,
  pinchEnter: 0.34,
  pinchExit: 0.55,
  fistHoldMs: 1200,
  margin: 0.12,
  showCamera: true,
  showSkeleton: true,
  deviceId: "",
};

const KEY = "gesture:settings";

export function loadGestureSettings(): GestureSettings {
  const s = loadSettings<GestureSettings>(KEY, GESTURE_DEFAULTS);
  // 兼容旧数据 & 防止阈值被写坏（Exit 必须大于 Enter，否则滞回失效）
  if (s.pinchExit <= s.pinchEnter) s.pinchExit = s.pinchEnter + 0.15;
  return s;
}

export function saveGestureSettings(s: GestureSettings) {
  saveSettings(KEY, s);
}

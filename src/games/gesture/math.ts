/**
 * 手势数学：全部为纯函数，便于 Node 单测。
 * 输入是 MediaPipe 归一化关键点（x/y ∈ 0~1，相对摄像头画面，未镜像）。
 */

export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

/** MediaPipe 手部 21 点索引 */
export const HAND = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

/** 掌心：腕 + 四指根的平均，比单点稳，抖动小一半。 */
export function palmCenter(lm: Landmark[]): { x: number; y: number } {
  const ids = [HAND.WRIST, HAND.INDEX_MCP, HAND.MIDDLE_MCP, HAND.RING_MCP, HAND.PINKY_MCP];
  let sx = 0;
  let sy = 0;
  for (const i of ids) {
    sx += lm[i].x;
    sy += lm[i].y;
  }
  return { x: sx / ids.length, y: sy / ids.length };
}

/** 手的尺度基准：腕到中指根的距离。所有阈值都用它归一，使远近距离都一致。 */
export function handScale(lm: Landmark[]): number {
  const a = lm[HAND.WRIST];
  const b = lm[HAND.MIDDLE_MCP];
  return Math.max(1e-4, Math.hypot(a.x - b.x, a.y - b.y));
}

/** 捏合量：拇指尖↔食指尖距离 / 手尺度。越小越「捏」，约 0.15 完全贴合，0.9 完全张开。 */
export function pinchRatio(lm: Landmark[]): number {
  const t = lm[HAND.THUMB_TIP];
  const i = lm[HAND.INDEX_TIP];
  return Math.hypot(t.x - i.x, t.y - i.y) / handScale(lm);
}

/**
 * 握拳程度 0~1：四个手指的「指尖到掌心距离 / 手尺度」平均后归一。
 * 1 表示完全蜷起（握拳），0 表示完全伸直。
 *
 * 标定依据：MediaPipe 手上「腕→中指根」约等于一个 handScale，
 * 伸直时指尖到掌心约 1.4 个 handScale，蜷起时约 0.55 个。
 */
export function fistClosure(lm: Landmark[]): number {
  const palm = palmCenter(lm);
  const base = handScale(lm);
  const tips = [HAND.INDEX_TIP, HAND.MIDDLE_TIP, HAND.RING_TIP, HAND.PINKY_TIP];
  let sum = 0;
  for (const tip of tips) {
    const p = lm[tip];
    const d = Math.hypot(p.x - palm.x, p.y - palm.y) / base;
    sum += clamp01((1.45 - d) / 0.75);
  }
  return clamp01(sum / tips.length);
}

/** 手掌张开度 0~1（五指张开的程度），用于「张开手掌 = 待命」的表现。 */
export function palmOpenness(lm: Landmark[]): number {
  return 1 - fistClosure(lm);
}

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * 带滞回的布尔判定器：rising 阈值触发、falling 阈值释放。
 * 捏合、握拳这类连续量必须用滞回，否则在阈值附近会疯狂抖动。
 */
export class Hysteresis {
  private state = false;
  private enterBelow: number;
  private exitAbove: number;

  constructor(enterBelow: number, exitAbove: number) {
    this.enterBelow = enterBelow;
    this.exitAbove = exitAbove;
  }

  update(value: number): boolean {
    if (this.state) {
      if (value > this.exitAbove) this.state = false;
    } else if (value < this.enterBelow) {
      this.state = true;
    }
    return this.state;
  }

  get value() {
    return this.state;
  }

  reset() {
    this.state = false;
  }
}

/**
 * One Euro Filter（Casiez 2012）：低速时强平滑消抖，高速时弱平滑跟手。
 * 手势控制的关键手感来源，比固定低通滤镜明显更好用。
 */
export class OneEuroFilter {
  private xPrev: number | null = null;
  private dxPrev = 0;
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;

  constructor(minCutoff = 1.2, beta = 0.02, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private static alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  /** value: 输入；dt: 距上次的秒数；返回滤波后的值 */
  filter(value: number, dt: number): number {
    if (this.xPrev === null || dt <= 0) {
      this.xPrev = value;
      this.dxPrev = 0;
      return value;
    }
    const dx = (value - this.xPrev) / dt;
    const aD = OneEuroFilter.alpha(this.dCutoff, dt);
    const dxHat = this.dxPrev + aD * (dx - this.dxPrev);
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = OneEuroFilter.alpha(cutoff, dt);
    const xHat = this.xPrev + a * (value - this.xPrev);
    this.xPrev = xHat;
    this.dxPrev = dxHat;
    return xHat;
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = 0;
  }
}

/**
 * 把摄像头归一化坐标映射到游戏归一化坐标。
 * - mirrored: 前置摄像头是镜像预览，X 需要翻转才符合「手往右飞往右」
 * - 内缩映射区：只用画面中间 [margin, 1-margin]，避免边缘手出画
 */
export function mapToStage(
  p: { x: number; y: number },
  mirrorX: boolean,
  margin: number,
): { x: number; y: number } {
  const rawX = mirrorX ? 1 - p.x : p.x;
  const span = Math.max(0.02, 1 - 2 * margin);
  return {
    x: clamp01((rawX - margin) / span),
    y: clamp01((p.y - margin) / span),
  };
}

/** 双手模式：用右手掌心相对飞船的位置算射击方向，限制在 ±maxAngle 弧度内。 */
export function aimFromHands(
  ship: { x: number; y: number },
  hand: { x: number; y: number },
  maxAngle = (70 * Math.PI) / 180,
): { x: number; y: number } {
  const dx = hand.x - ship.x;
  // 屏幕上永远朝上射（负 Y），水平分量决定偏转
  const dy = -Math.abs(hand.y - ship.y) - 0.02;
  let angle = Math.atan2(dy, dx);
  // 转成「相对正上方」的偏角
  let offset = angle + Math.PI / 2;
  if (offset > Math.PI) offset -= Math.PI * 2;
  if (offset < -Math.PI) offset += Math.PI * 2;
  offset = Math.max(-maxAngle, Math.min(maxAngle, offset));
  const a = -Math.PI / 2 + offset;
  return { x: Math.cos(a), y: Math.sin(a) };
}

/** 握拳保持判定：返回是否已持续 holdMs。 */
export function heldLongEnough(heldMs: number, holdMs: number): boolean {
  return heldMs >= holdMs;
}

/** 判断两只手里哪只是左手（MediaPipe 的 label 是「被摄者视角」；镜像画面下会反转）。 */
export function resolveHandedness(labels: string[], mirrored: boolean): string[] {
  if (!mirrored) return labels;
  return labels.map((l) => {
    if (l === "Left") return "Right";
    if (l === "Right") return "Left";
    return l;
  });
}

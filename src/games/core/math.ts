/** 通用数学工具。纯函数为主，可被 Node 单测直接引用。 */

export const TAU = Math.PI * 2;

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 与帧率无关的指数趋近：halfLife 为「走完一半距离所需秒数」。 */
export function damp(a: number, b: number, halfLife: number, dt: number): number {
  if (halfLife <= 0) return b;
  const t = 1 - Math.pow(0.5, dt / halfLife);
  return a + (b - a) * t;
}

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function distSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** 圆形碰撞：用平方距离避免开方。 */
export function circleHit(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean {
  const r = ar + br;
  return distSq(ax, ay, bx, by) <= r * r;
}

export function angleOf(dx: number, dy: number): number {
  return Math.atan2(dy, dx);
}

export function normalize(x: number, y: number): { x: number; y: number; len: number } {
  const len = Math.hypot(x, y);
  if (len < 1e-6) return { x: 0, y: -1, len: 0 };
  return { x: x / len, y: y / len, len };
}

export function easeOutCubic(t: number): number {
  const p = 1 - clamp01(t);
  return 1 - p * p * p;
}

export function easeOutQuad(t: number): number {
  const p = 1 - clamp01(t);
  return 1 - p * p;
}

/** 把 0~1 的输入按 deadzone 重映射到 0~1，避免中心区域抖动。 */
export function applyDeadzone(v: number, deadzone: number): number {
  const d = clamp01(deadzone);
  if (d >= 0.5) return v < 0.5 ? 0 : 1;
  const t = clamp01((v - d) / (1 - 2 * d));
  return t;
}

export function formatScore(n: number): string {
  return Math.max(0, Math.floor(n)).toString().padStart(6, "0");
}

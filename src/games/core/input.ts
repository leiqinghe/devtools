import { idleFrame } from "../types";
import type { ControlFrame, ControlSource, ControlSourceKind } from "../types";
import { clamp01 } from "./math";

/** 指针 / 触屏输入：进入即自动开火，拖动移动；鼠标右键 / 触屏双击 = 炸弹。 */
export class PointerSource implements ControlSource {
  readonly kind: ControlSourceKind = "pointer";
  private target: HTMLElement;
  private x = 0.5;
  private y = 0.8;
  private inside = false;
  private specialFrames = 0;
  private pauseFrames = 0;
  /** 触屏双击放炸弹的判定窗口 */
  private lastTapTime = 0;
  private lastTapX = 0;
  private lastTapY = 0;

  constructor(target: HTMLElement) {
    this.target = target;
    target.addEventListener("pointermove", this.onMove);
    target.addEventListener("pointerdown", this.onDown);
    target.addEventListener("pointerleave", this.onLeave);
    target.addEventListener("pointercancel", this.onLeave);
    target.addEventListener("contextmenu", this.onContextMenu);
  }

  private toLocal(e: PointerEvent) {
    const rect = this.target.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.x = clamp01((e.clientX - rect.left) / rect.width);
    this.y = clamp01((e.clientY - rect.top) / rect.height);
    this.inside = true;
  }

  private onMove = (e: PointerEvent) => this.toLocal(e);

  private onDown = (e: PointerEvent) => {
    this.toLocal(e);
    if (e.button === 2) {
      this.specialFrames = 2;
      return;
    }
    if (e.pointerType === "touch") {
      // 300ms 内近距离二次点按 = 双击 → 炸弹
      const now = performance.now();
      const near = Math.hypot(e.clientX - this.lastTapX, e.clientY - this.lastTapY) < 44;
      if (now - this.lastTapTime < 300 && near) {
        this.specialFrames = 2;
        this.lastTapTime = 0;
      } else {
        this.lastTapTime = now;
        this.lastTapX = e.clientX;
        this.lastTapY = e.clientY;
      }
    }
  };

  private onLeave = () => {
    this.inside = false;
  };

  private onContextMenu = (e: Event) => e.preventDefault();

  /** 键盘触发的一次性动作（空格炸弹 / Esc 暂停），由页面在 keydown 时调用。 */
  triggerSpecial() {
    this.specialFrames = 2;
  }

  triggerPause() {
    this.pauseFrames = 2;
  }

  /** 供键盘控制写入的目标位置（归一化）。 */
  setTarget(x: number, y: number) {
    this.x = clamp01(x);
    this.y = clamp01(y);
    this.inside = true;
  }

  getTarget() {
    return { x: this.x, y: this.y };
  }

  frame(): ControlFrame {
    const f: ControlFrame = {
      ...idleFrame(),
      x: this.x,
      y: this.y,
      // 与手势模式一致：进入画布即自动开火，右键（specialFrames）为炸弹
      fire: this.inside,
      special: this.specialFrames > 0,
      pause: this.pauseFrames > 0,
      live: this.inside,
      source: "pointer",
    };
    if (this.specialFrames > 0) this.specialFrames -= 1;
    if (this.pauseFrames > 0) this.pauseFrames -= 1;
    return f;
  }

  destroy() {
    const t = this.target;
    t.removeEventListener("pointermove", this.onMove);
    t.removeEventListener("pointerdown", this.onDown);
    t.removeEventListener("pointerleave", this.onLeave);
    t.removeEventListener("pointercancel", this.onLeave);
    t.removeEventListener("contextmenu", this.onContextMenu);
  }
}

/** 键盘输入：方向键 / WASD 移动，空格炸弹，Esc 暂停，按住 Shift 加速。 */
export class KeyboardSource implements ControlSource {
  readonly kind: ControlSourceKind = "keyboard";
  private keys = new Set<string>();
  private x = 0.5;
  private y = 0.8;
  private specialFrames = 0;
  private pauseFrames = 0;
  private speed = 0.9; // 归一化单位/秒

  constructor() {
    window.addEventListener("keydown", this.onDown);
    window.addEventListener("keyup", this.onUp);
    window.addEventListener("blur", this.onBlur);
  }

  private onDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const k = e.key.toLowerCase();
    this.keys.add(k);
    if (k === " " || k === "spacebar") {
      e.preventDefault();
      this.specialFrames = 2;
    }
    if (k === "escape") this.pauseFrames = 2;
  };

  private onUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  private onBlur = () => this.keys.clear();

  /** 由主循环每帧调用，按固定 dt 推进位置，保证不同帧率速度一致。 */
  step(dt: number) {
    let dx = 0;
    let dy = 0;
    if (this.keys.has("arrowleft") || this.keys.has("a")) dx -= 1;
    if (this.keys.has("arrowright") || this.keys.has("d")) dx += 1;
    if (this.keys.has("arrowup") || this.keys.has("w")) dy -= 1;
    if (this.keys.has("arrowdown") || this.keys.has("s")) dy += 1;
    if (dx === 0 && dy === 0) return;
    const len = Math.hypot(dx, dy);
    const boost = this.keys.has("shift") ? 1.7 : 1;
    this.x = clamp01(this.x + (dx / len) * this.speed * boost * dt);
    this.y = clamp01(this.y + (dy / len) * this.speed * boost * dt);
  }

  /** 是否有方向键按下（供组合输入源决定优先级）。 */
  get moving(): boolean {
    return (
      this.keys.has("arrowleft") ||
      this.keys.has("arrowright") ||
      this.keys.has("arrowup") ||
      this.keys.has("arrowdown") ||
      this.keys.has("a") ||
      this.keys.has("d") ||
      this.keys.has("w") ||
      this.keys.has("s")
    );
  }

  get position() {
    return { x: this.x, y: this.y };
  }

  frame(): ControlFrame {
    const f: ControlFrame = {
      ...idleFrame(),
      x: this.x,
      y: this.y,
      special: this.specialFrames > 0,
      pause: this.pauseFrames > 0,
      live: true,
      source: "keyboard",
    };
    if (this.specialFrames > 0) this.specialFrames -= 1;
    if (this.pauseFrames > 0) this.pauseFrames -= 1;
    return f;
  }

  destroy() {
    window.removeEventListener("keydown", this.onDown);
    window.removeEventListener("keyup", this.onUp);
    window.removeEventListener("blur", this.onBlur);
  }
}

/**
 * 手势控制源：把 HandTracker 的 21 点结果变成 ControlFrame。
 *
 * 单手（默认）：掌心位置 → 飞船位置；自动开火；捏合 → 炸弹；握拳 1.2s → 暂停。
 * 双手：左手定位、右手瞄准；任一只手捏合 → 炸弹；只识别到一只手时自动降级为单手。
 */
import type { ControlFrame, ControlSource, Point } from "../types";
import { idleFrame } from "../types";
import { clamp01, damp } from "../core/math";
import type { HandObservation, HandTracker } from "./tracker";
import {
  aimFromHands,
  fistClosure,
  Hysteresis,
  mapToStage,
  OneEuroFilter,
  palmCenter,
  pinchRatio,
  resolveHandedness,
  type Landmark,
} from "./math";
import type { GestureSettings } from "./settings";

/** 手丢失后仍保持上一位置的宽限时间（秒），避免偶尔丢帧导致飞船乱跳 */
const LOST_GRACE = 0.6;

export interface HandSourceOptions {
  tracker: HandTracker;
  settings: GestureSettings;
  /** 摄像头画面是否镜像（前置默认镜像） */
  mirrored?: boolean;
}

export class HandSource implements ControlSource {
  readonly kind = "hand" as const;
  private tracker: HandTracker;
  private settings: GestureSettings;
  private mirrored: boolean;

  private fx = new OneEuroFilter(1.1, 0.03);
  private fy = new OneEuroFilter(1.1, 0.03);
  private fx2 = new OneEuroFilter(1.0, 0.02);
  private fy2 = new OneEuroFilter(1.0, 0.02);

  private x = 0.5;
  private y = 0.82;
  private aim: Point = { x: 0, y: -1 };
  private lostTime = 0;
  private pinch = new Hysteresis(0.34, 0.55);
  private pinch2 = new Hysteresis(0.34, 0.55);
  private fistHeld = 0;
  private pauseLatch = false;
  private lastHands = 0;
  private lastConfidence = 0;
  private lastPinch = 1;
  private lastFist = 0;
  private specialFrames = 0;
  private pauseFrames = 0;
  private hasPosition = false;

  constructor(opts: HandSourceOptions) {
    this.tracker = opts.tracker;
    this.settings = opts.settings;
    this.mirrored = opts.mirrored ?? true;
    this.applyThresholds();
    this.fx = new OneEuroFilter(opts.settings.smoothing * 0.9, 0.03);
    this.fy = new OneEuroFilter(opts.settings.smoothing * 0.9, 0.03);
    this.fx2 = new OneEuroFilter(opts.settings.smoothing * 0.8, 0.02);
    this.fy2 = new OneEuroFilter(opts.settings.smoothing * 0.8, 0.02);
  }

  private applyThresholds() {
    this.pinch = new Hysteresis(this.settings.pinchEnter, this.settings.pinchExit);
    this.pinch2 = new Hysteresis(this.settings.pinchEnter, this.settings.pinchExit);
  }

  updateSettings(next: GestureSettings) {
    this.settings = next;
    this.applyThresholds();
    this.fx = new OneEuroFilter(next.smoothing * 0.9, 0.03);
    this.fy = new OneEuroFilter(next.smoothing * 0.9, 0.03);
    this.fx2 = new OneEuroFilter(next.smoothing * 0.8, 0.02);
    this.fy2 = new OneEuroFilter(next.smoothing * 0.8, 0.02);
    this.tracker.numHands = next.twoHands ? 2 : 1;
    void this.tracker.setNumHands(this.tracker.numHands);
  }

  /** 读取与更新逻辑每帧调用一次（固定步长），保证平滑结果与帧率无关。 */
  update(dt: number, now: number) {
    const hands =
      this.trackerVideo && this.tracker.ready ? this.tracker.detect(this.trackerVideo, now) : [];
    if (hands.length === 0) {
      this.lostTime += dt;
      this.lastHands = 0;
      this.lastConfidence = 0;
      this.pinch.update(1);
      this.pinch2.update(1);
      this.fistHeld = Math.max(0, this.fistHeld - dt);
      this.pauseLatch = false;
      return;
    }

    this.lostTime = 0;
    this.lastHands = hands.length;

    const twoHand = this.settings.twoHands && hands.length >= 2;
    const primary = this.pickPrimary(hands, twoHand);
    if (!primary) return;

    this.lastConfidence = primary.score;
    // 前置摄像头是镜像预览，X 需翻转
    const palm = palmCenter(primary.landmarks);
    const mapped = mapToStage(palm, this.mirrored, this.settings.margin);
    const useFilter = this.hasPosition;
    const nx = useFilter ? this.fx.filter(mapped.x, dt) : mapped.x;
    const ny = useFilter ? this.fy.filter(mapped.y, dt) : mapped.y;
    this.x = clamp01(nx);
    this.y = clamp01(ny);
    this.hasPosition = true;

    // 捏合 → 炸弹（边沿触发，一次捏合给 2 帧）
    const pinchVal = pinchRatio(primary.landmarks);
    this.lastPinch = pinchVal;
    const pinching = this.pinch.update(pinchVal);
    if (pinching) this.specialFrames = Math.max(this.specialFrames, 2);

    // 握拳 → 暂停（保持一段时间后触发一次，松开才复位）
    const fist = fistClosure(primary.landmarks);
    this.lastFist = fist;
    if (fist > 0.72) {
      this.fistHeld += dt;
      if (this.fistHeld * 1000 >= this.settings.fistHoldMs && !this.pauseLatch) {
        this.pauseLatch = true;
        this.pauseFrames = Math.max(this.pauseFrames, 2);
      }
    } else {
      this.fistHeld = 0;
      this.pauseLatch = false;
    }

    // 双手瞄准
    if (twoHand) {
      const secondary = this.pickSecondary(hands, primary);
      if (secondary) {
        const sp = mapToStage(palmCenter(secondary.landmarks), this.mirrored, this.settings.margin);
        const sx = this.fx2.filter(sp.x, dt);
        const sy = this.fy2.filter(sp.y, dt);
        this.aim = aimFromHands({ x: this.x, y: this.y }, { x: sx, y: sy });
        const pinch2Val = pinchRatio(secondary.landmarks);
        if (this.pinch2.update(pinch2Val)) this.specialFrames = Math.max(this.specialFrames, 2);
        return;
      }
    }
    this.aim = { x: 0, y: -1 };
  }

  /** 由页面注入视频元素，供 tracker.detect 使用。 */
  private trackerVideo: HTMLVideoElement | null = null;

  attachVideo(video: HTMLVideoElement | null) {
    this.trackerVideo = video;
  }

  /**
   * 双手模式下区分主副手：默认左手定位、右手瞄准。
   * 若 handedness 不可靠（Unknown），用位置区分：靠左的是定位手。
   */
  private pickPrimary(hands: HandObservation[], twoHand: boolean): HandObservation | null {
    if (!twoHand) {
      // 单手：取置信度最高的那只
      return hands.reduce((a, b) => (b.score > a.score ? b : a), hands[0]);
    }
    const labels = resolveHandedness(
      hands.map((h) => h.handedness),
      this.mirrored,
    );
    const leftIdx = labels.findIndex((l) => l === "Left");
    const rightIdx = labels.findIndex((l) => l === "Right");
    if (leftIdx >= 0) return hands[leftIdx];
    if (rightIdx >= 0) return hands[rightIdx === 0 ? 1 % hands.length : rightIdx];
    const sorted = [...hands].sort((a, b) => palmCenter(a.landmarks).x - palmCenter(b.landmarks).x);
    return sorted[0];
  }

  private pickSecondary(hands: HandObservation[], primary: HandObservation): HandObservation | null {
    const others = hands.filter((h) => h !== primary);
    if (others.length === 0) return null;
    if (others.length === 1) return others[0];
    const labels = resolveHandedness(
      others.map((h) => h.handedness),
      this.mirrored,
    );
    const rightIdx = labels.findIndex((l) => l === "Right");
    return rightIdx >= 0 ? others[rightIdx] : others[0];
  }

  /** 供 HUD 显示当前手势读数 */
  get readouts() {
    return {
      pinch: this.lastPinch,
      fist: this.lastFist,
      hands: this.lastHands,
      confidence: this.lastConfidence,
      lostFor: this.lostTime,
      fistProgress: Math.min(1, (this.fistHeld * 1000) / this.settings.fistHoldMs),
    };
  }

  get position() {
    return { x: this.x, y: this.y };
  }

  frame(): ControlFrame {
    const alive = this.lostTime < LOST_GRACE;
    const f: ControlFrame = {
      ...idleFrame(),
      x: this.x,
      y: this.y,
      aim: this.aim,
      fire: alive && this.lastHands > 0,
      special: this.specialFrames > 0,
      pause: this.pauseFrames > 0,
      live: alive && this.lastHands > 0,
      hands: this.lastHands,
      confidence: this.lastConfidence,
      source: "hand",
    };
    if (this.specialFrames > 0) this.specialFrames -= 1;
    if (this.pauseFrames > 0) this.pauseFrames -= 1;
    return f;
  }

  /** 手动清空（切页面/关闭摄像头时） */
  reset() {
    this.lostTime = LOST_GRACE;
    this.hasPosition = false;
    this.fx.reset();
    this.fy.reset();
    this.fx2.reset();
    this.fy2.reset();
    this.pinch.reset();
    this.pinch2.reset();
    this.fistHeld = 0;
    this.pauseLatch = false;
    this.lastHands = 0;
    this.lastConfidence = 0;
    this.tracker.clear();
  }

  destroy() {
    this.reset();
    this.trackerVideo = null;
  }
}

export type { Landmark };
export { damp };

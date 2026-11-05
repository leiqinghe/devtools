/** 游戏平台与具体游戏之间的公共类型。此处不依赖 React / antd，方便后续整体搬进独立 App。 */

/** 归一化坐标（0~1，左上角原点），与逻辑分辨率无关。 */
export interface Point {
  x: number;
  y: number;
}

export type ControlSourceKind = "hand" | "pointer" | "keyboard" | "touch" | "idle";

/**
 * 所有输入源（手势 / 鼠标 / 键盘 / 触屏）统一输出这一帧。
 * 新游戏只需消费 ControlFrame，不必关心信号来源。
 */
export interface ControlFrame {
  /** 飞船目标位置，归一化到 0~1 */
  x: number;
  y: number;
  /** 射击方向单位向量，默认朝上 (0,-1) */
  aim: Point;
  /** 持续开火 */
  fire: boolean;
  /** 释放技能（炸弹），按下期间的每一帧为 true，游戏侧自行做边沿检测 */
  special: boolean;
  /** 暂停键按下 */
  pause: boolean;
  /** 当前是否有有效信号（手丢失 / 鼠标未进入画布时为 false） */
  live: boolean;
  /** 识别到的手数量，非手势源恒为 0 */
  hands: number;
  /** 信号置信度 0~1，用于 HUD 提示 */
  confidence: number;
  source: ControlSourceKind;
}

export function idleFrame(): ControlFrame {
  return {
    x: 0.5,
    y: 0.8,
    aim: { x: 0, y: -1 },
    fire: false,
    special: false,
    pause: false,
    live: false,
    hands: 0,
    confidence: 0,
    source: "idle",
  };
}

export interface ControlSource {
  readonly kind: ControlSourceKind;
  /** 每帧调用，返回当前控制帧；实现需自行保证不抛异常 */
  frame(): ControlFrame;
  /** 可选：需要按时间推进的实现（手势平滑、键盘移动）在固定步长里被调用 */
  update?(dt: number, now: number): void;
  /** 释放监听、停止相机等 */
  destroy(): void;
}

/** 游戏页面与 React 层之间的状态回传。 */
export type GamePhase = "ready" | "playing" | "paused" | "over";

export interface GameRunStats {
  score: number;
  wave: number;
  maxCombo: number;
  kills: number;
  durationMs: number;
  source: ControlSourceKind;
}

export interface GameMeta {
  id: string;
  title: string;
  subtitle: string;
  desc: string;
  path: string;
  /** 支持的控制方式，用于游戏中心展示 */
  controls: string[];
  /** 卡片主色，纯 CSS 值 */
  accent: string;
  status: "playable" | "planned";
}

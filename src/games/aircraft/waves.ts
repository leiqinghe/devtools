/**
 * 波次脚本：1~9 波手工设计（教学曲线），之后进入无限递增模式。
 * 波次结构用纯数据描述，方便单测与后续可视化编辑。
 */
import type { EnemyKind } from "./balance";

export type SpawnGroup = {
  kind: EnemyKind;
  /** 生成数量 */
  count: number;
  /** 组内间隔（秒） */
  gap: number;
  /** 本组开始前的延迟（秒） */
  delay: number;
  /** 生成横向位置，0~1 归一化；不填则随机 */
  slot?: number;
  /** 横向抖动范围（归一化） */
  jitter?: number;
};

export interface WaveDef {
  /** 波次序号，从 1 开始 */
  index: number;
  /** 是否 Boss 波 */
  boss: boolean;
  groups: SpawnGroup[];
  /** 本波清空后到下一波的间隔（秒） */
  rest: number;
}

const TUTORIAL: WaveDef[] = [
  {
    index: 1,
    boss: false,
    rest: 1.6,
    groups: [{ kind: "small", count: 5, gap: 0.55, delay: 1.2, slot: 0.5, jitter: 0.32 }],
  },
  {
    index: 2,
    boss: false,
    rest: 1.4,
    groups: [
      { kind: "small", count: 4, gap: 0.45, delay: 1.0, slot: 0.3, jitter: 0.12 },
      { kind: "small", count: 4, gap: 0.45, delay: 0.1, slot: 0.7, jitter: 0.12 },
    ],
  },
  {
    index: 3,
    boss: false,
    rest: 1.4,
    groups: [
      { kind: "zig", count: 3, gap: 0.8, delay: 1.0, slot: 0.5, jitter: 0.18 },
      { kind: "small", count: 4, gap: 0.4, delay: 0.4, slot: 0.5, jitter: 0.4 },
    ],
  },
  {
    index: 4,
    boss: false,
    rest: 1.5,
    groups: [
      { kind: "turret", count: 1, gap: 0, delay: 1.0, slot: 0.28, jitter: 0 },
      { kind: "turret", count: 1, gap: 0, delay: 0.5, slot: 0.72, jitter: 0 },
      { kind: "small", count: 5, gap: 0.4, delay: 0.8, slot: 0.5, jitter: 0.38 },
    ],
  },
  {
    index: 5,
    boss: true,
    rest: 2.6,
    groups: [],
  },
  {
    index: 6,
    boss: false,
    rest: 1.4,
    groups: [
      { kind: "heavy", count: 1, gap: 0, delay: 1.0, slot: 0.5, jitter: 0 },
      { kind: "small", count: 6, gap: 0.32, delay: 0.6, slot: 0.5, jitter: 0.42 },
    ],
  },
  {
    index: 7,
    boss: false,
    rest: 1.3,
    groups: [
      { kind: "zig", count: 5, gap: 0.55, delay: 0.8, slot: 0.5, jitter: 0.34 },
      { kind: "turret", count: 2, gap: 0.8, delay: 1.6, slot: 0.5, jitter: 0.3 },
    ],
  },
  {
    index: 8,
    boss: false,
    rest: 1.4,
    groups: [
      { kind: "heavy", count: 2, gap: 1.1, delay: 0.9, slot: 0.35, jitter: 0.1 },
      { kind: "zig", count: 4, gap: 0.5, delay: 0.4, slot: 0.65, jitter: 0.22 },
    ],
  },
  {
    index: 9,
    boss: false,
    rest: 1.5,
    groups: [
      { kind: "turret", count: 3, gap: 0.6, delay: 0.8, slot: 0.5, jitter: 0.34 },
      { kind: "small", count: 6, gap: 0.28, delay: 1.2, slot: 0.5, jitter: 0.44 },
    ],
  },
  { index: 10, boss: true, rest: 2.6, groups: [] },
];

/** 波次 11+ 的无限模式：每 5 波一个 Boss，其余按难度递增随机组合。 */
function generate(index: number): WaveDef {
  const later = index > 10;
  if (!later) return TUTORIAL[Math.min(index, TUTORIAL.length) - 1];

  if (index % 5 === 0) return { index, boss: true, rest: 2.6, groups: [] };

  const tier = Math.floor((index - 11) / 5); // 每 5 波升一档
  const extra = Math.min(6, 2 + tier);
  return {
    index,
    boss: false,
    rest: 1.3,
    groups: [
      { kind: "small", count: extra + 2, gap: 0.26, delay: 0.8, slot: 0.5, jitter: 0.45 },
      { kind: "zig", count: extra, gap: 0.42, delay: 0.7, slot: 0.32, jitter: 0.2 },
      { kind: "heavy", count: 1 + Math.min(2, tier), gap: 0.9, delay: 0.9, slot: 0.68, jitter: 0.18 },
    ],
  };
}

export function getWave(index: number): WaveDef {
  if (index <= TUTORIAL.length) return TUTORIAL[index - 1];
  return generate(index);
}

/** 本波总敌人数（用于进度显示与「清屏判断」） */
export function waveEnemyCount(wave: WaveDef): number {
  if (wave.boss) return 1;
  return wave.groups.reduce((sum, g) => sum + g.count, 0);
}

/**
 * 把波次展开成「按时间的生成计划」，纯函数，便于单测。
 * 返回相对本波开始的秒数。
 */
export function buildSchedule(wave: WaveDef): { kind: EnemyKind; at: number; slot?: number; jitter?: number }[] {
  const plan: { kind: EnemyKind; at: number; slot?: number; jitter?: number }[] = [];
  for (const g of wave.groups) {
    for (let i = 0; i < g.count; i += 1) {
      plan.push({ kind: g.kind, at: g.delay + i * g.gap, slot: g.slot, jitter: g.jitter });
    }
  }
  return plan.sort((a, b) => a.at - b.at);
}

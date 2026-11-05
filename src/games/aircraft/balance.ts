/**
 * 飞机大战数值表：手感调参的唯一入口。
 * 所有距离/速度都用逻辑像素（逻辑画布 540×960），改这里即可整体调难度。
 */

export const STAGE_W = 540;
export const STAGE_H = 960;

export const PLAYER = {
  radius: 15,
  /** 归一化坐标到逻辑像素的跟手速度（越大越跟手，越小越飘） */
  followHalfLife: 0.045,
  maxLives: 3,
  /** 复活无敌时长（秒） */
  invulnTime: 2,
  /** 受击后短暂无敌 */
  hitInvuln: 1.4,
  startY: 0.82,
  /** 视觉尺寸 */
  drawW: 76,
  drawH: 76,
  hitRadius: 11,
};

/** 武器等级 1~5：等级越高弹道越多 */
export const WEAPONS = [
  { level: 1, cooldown: 0.16, dmg: 1, spread: 0, count: 1 },
  { level: 2, cooldown: 0.135, dmg: 1, spread: 0, count: 2, offset: 11 },
  { level: 3, cooldown: 0.125, dmg: 1, spread: 0.16, count: 3 },
  { level: 4, cooldown: 0.115, dmg: 1, spread: 0.2, count: 4 },
  { level: 5, cooldown: 0.1, dmg: 1, spread: 0.24, count: 5 },
];

export const BULLET = {
  playerSpeed: 900,
  playerRadius: 5,
  enemySpeed: 300,
  enemyRadius: 6,
  /** 出屏多少像素后回收 */
  cullMargin: 40,
};

export const ENEMY = {
  small: {
    hp: 2,
    speed: 150,
    radius: 20,
    drawW: 48,
    drawH: 48,
    score: 100,
    dropChance: 0.06,
  },
  zig: {
    hp: 3,
    speed: 130,
    radius: 22,
    drawW: 54,
    drawH: 54,
    score: 160,
    dropChance: 0.1,
  },
  heavy: {
    hp: 9,
    speed: 78,
    radius: 32,
    drawW: 84,
    drawH: 84,
    score: 320,
    dropChance: 0.42,
  },
  turret: {
    hp: 5,
    speed: 60,
    radius: 26,
    drawW: 62,
    drawH: 62,
    score: 260,
    dropChance: 0.2,
  },
  boss: {
    hp: 130,
    speed: 52,
    radius: 96,
    drawW: 300,
    drawH: 300,
    score: 4000,
    dropChance: 1,
  },
} as const;

export type EnemyKind = keyof typeof ENEMY;

export const COMBO = {
  /** 连击窗口（秒），超时清零 */
  window: 2.2,
  /** 每击杀一次倍率 +1，最高 8 */
  maxMultiplier: 8,
};

export const PICKUP = {
  speed: 110,
  radius: 16,
  duration: 0.7, // 拾取动画
  powerTime: 0,
  shieldTime: 6,
  bombGain: 1,
  maxBombs: 3,
};

/** 炸弹：全屏伤害 + 清弹 */
export const BOMB = {
  damage: 12,
  screenFlash: 0.35,
  shake: 22,
};

export const BOSS = {
  /** 每次进入 Boss 波，血量按波次放大 */
  hpScale: 1.35,
  /** 阶段切换血量百分比 */
  phase2: 0.6,
  phase3: 0.3,
  fireInterval1: 1.5,
  fireInterval2: 1.0,
  fireInterval3: 0.62,
  enterY: 0.16,
};

/** 波次难度曲线 */
export function difficulty(wave: number) {
  const w = Math.max(1, wave);
  return {
    hp: 1 + (w - 1) * 0.16,
    speed: Math.min(1.9, 1 + (w - 1) * 0.05),
    spawnRate: Math.min(2.4, 1 + (w - 1) * 0.09),
  };
}

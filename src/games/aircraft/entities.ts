/** 实体定义与行为更新。保持纯数据 + 函数，渲染在 game.ts。 */
import { ENEMY, BULLET, STAGE_H, STAGE_W, type EnemyKind } from "./balance";
import { clamp, rand, TAU } from "../core/math";

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  r: number;
  age: number;
  /** 开火冷却（秒），<=0 表示可以开火 */
  cool: number;
  /** 受击闪白剩余时间 */
  flash: number;
  dead: boolean;
  /** 正弦轨迹基准 X */
  baseX: number;
  amp: number;
  freq: number;
  /** Boss 专用：已进入的阶段 1~3 */
  phase: number;
  /** Boss 入场中 */
  entering: boolean;
  score: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  friendly: boolean;
  color: string;
  dead: boolean;
  /** 拖尾长度（逻辑像素） */
  trail: number;
}

export type PickupKind = "power" | "shield" | "bomb";

export interface Pickup {
  x: number;
  y: number;
  vy: number;
  kind: PickupKind;
  age: number;
  dead: boolean;
}

let nextId = 1;

export function resetIds() {
  nextId = 1;
}

export function makeEnemy(kind: EnemyKind, x: number, y: number, hpScale = 1, speedScale = 1): Enemy {
  const def = ENEMY[kind];
  const hp = Math.max(1, Math.round(def.hp * hpScale));
  return {
    id: nextId++,
    kind,
    x,
    y,
    vx: 0,
    vy: def.speed * speedScale,
    hp,
    maxHp: hp,
    r: def.radius,
    age: 0,
    cool: kind === "turret" ? rand(0.8, 1.6) : 0,
    flash: 0,
    dead: false,
    baseX: x,
    amp: rand(50, 95),
    freq: rand(0.55, 1.05),
    phase: 1,
    entering: kind === "boss",
    score: def.score,
  };
}

export function makeBullet(
  x: number,
  y: number,
  vx: number,
  vy: number,
  friendly: boolean,
  dmg = 1,
  color = friendly ? "#8ef0ff" : "#ff6b8a",
): Bullet {
  return {
    x,
    y,
    vx,
    vy,
    r: friendly ? BULLET.playerRadius : BULLET.enemyRadius,
    dmg,
    friendly,
    color,
    dead: false,
    trail: friendly ? 18 : 8,
  };
}

/**
 * 更新单个敌机。返回本帧要发射的子弹（世界层面负责 push）。
 * shooter 为玩家位置，供炮台与 Boss 瞄准。
 */
export function updateEnemy(
  e: Enemy,
  dt: number,
  shooter: { x: number; y: number },
  out: Bullet[],
  bossInterval: number,
) {
  e.age += dt;
  if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);

  switch (e.kind) {
    case "small": {
      e.y += e.vy * dt;
      break;
    }
    case "zig": {
      e.y += e.vy * dt;
      e.x = e.baseX + Math.sin(e.age * e.freq * TAU) * e.amp;
      break;
    }
    case "heavy": {
      e.y += e.vy * dt;
      e.x = e.baseX + Math.sin(e.age * 0.6) * 16;
      break;
    }
    case "turret": {
      // 下降到 1/3 屏高后停住，持续点射玩家
      const stopY = STAGE_H * 0.3;
      if (e.y < stopY) e.y += e.vy * dt;
      else e.y += Math.sin(e.age * 1.6) * 12 * dt;
      e.cool -= dt;
      if (e.cool <= 0 && e.y > stopY - 10) {
        e.cool = 1.7;
        fireAimed(e, shooter, out, BULLET.enemySpeed * 1.05, 1, "#ffcb6b");
      }
      break;
    }
    case "boss": {
      if (e.entering) {
        e.y += 90 * dt;
        if (e.y >= STAGE_H * 0.16) {
          e.y = STAGE_H * 0.16;
          e.entering = false;
          e.cool = 1.2;
        }
        break;
      }
      e.x = STAGE_W / 2 + Math.sin(e.age * 0.42) * (STAGE_W * 0.22);
      e.cool -= dt;
      if (e.cool <= 0) {
        e.cool = bossInterval;
        bossFire(e, shooter, out);
      }
      break;
    }
    default:
      break;
  }
}

function fireAimed(
  e: Enemy,
  target: { x: number; y: number },
  out: Bullet[],
  speed: number,
  dmg = 1,
  color = "#ff6b8a",
) {
  const dx = target.x - e.x;
  const dy = target.y - e.y;
  const len = Math.max(1e-3, Math.hypot(dx, dy));
  out.push(makeBullet(e.x, e.y + e.r * 0.6, (dx / len) * speed, (dy / len) * speed, false, dmg, color));
}

/** Boss 三段弹幕：扇形连射 → 旋转双环 → 追踪散射 + 侧翼 */
function bossFire(e: Enemy, target: { x: number; y: number }, out: Bullet[]) {
  const phase = e.hp / e.maxHp > 0.6 ? 1 : e.hp / e.maxHp > 0.3 ? 2 : 3;

  if (phase === 1) {
    const n = 7;
    for (let i = 0; i < n; i += 1) {
      const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.14;
      out.push(makeBullet(e.x, e.y + 40, Math.cos(a) * 250, Math.sin(a) * 250, false, 1, "#ff8a6b"));
    }
    return;
  }

  if (phase === 2) {
    const spin = e.age * 2.2;
    for (let ring = 0; ring < 2; ring += 1) {
      const base = spin + ring * Math.PI;
      for (let i = 0; i < 8; i += 1) {
        const a = base + (i / 8) * TAU;
        out.push(makeBullet(e.x, e.y, Math.cos(a) * 190, Math.sin(a) * 190, false, 1, "#ff5f7a"));
      }
    }
    return;
  }

  // phase 3：左右侧翼 + 追击扇形
  for (const side of [-1, 1]) {
    out.push(
      makeBullet(e.x + side * 70, e.y + 30, side * 60, 300, false, 1, "#ff3f66"),
    );
  }
  const dx = target.x - e.x;
  const dy = target.y - e.y;
  const baseA = Math.atan2(dy, dx);
  for (let i = -1; i <= 1; i += 1) {
    const a = baseA + i * 0.22;
    out.push(makeBullet(e.x, e.y + 36, Math.cos(a) * 330, Math.sin(a) * 330, false, 1, "#ffb199"));
  }
}

/** 敌机是否该回收（出屏底部或太偏） */
export function shouldCull(e: Enemy): boolean {
  if (e.kind === "boss") return e.dead;
  return e.y > STAGE_H + 80 || e.x < -160 || e.x > STAGE_W + 160;
}

/** 掉落判定 */
export function rollDrop(kind: EnemyKind): PickupKind | null {
  const chance = ENEMY[kind].dropChance;
  if (Math.random() > chance) return null;
  const roll = Math.random();
  if (roll < 0.55) return "power";
  if (roll < 0.85) return "shield";
  return "bomb";
}

export function makePickup(x: number, y: number, kind: PickupKind): Pickup {
  return { x, y, vy: 110, kind, age: 0, dead: false };
}

/** 道具轻微左右摆动，避免直线下落太单调 */
export function updatePickup(p: Pickup, dt: number) {
  p.age += dt;
  p.y += p.vy * dt;
  p.x += Math.sin(p.age * 3.2) * 26 * dt;
  if (p.y > STAGE_H + 40) p.dead = true;
}

export function updateBullet(b: Bullet, dt: number) {
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  if (
    b.y < -BULLET.cullMargin ||
    b.y > STAGE_H + BULLET.cullMargin ||
    b.x < -BULLET.cullMargin ||
    b.x > STAGE_W + BULLET.cullMargin
  ) {
    b.dead = true;
  }
}

/** 受击后的散射火花方向（供渲染层取用） */
export function impactAngle(vx: number, vy: number): number {
  return Math.atan2(vy, vx);
}

/** 血条比例 */
export function hpRatio(e: Enemy): number {
  return clamp(e.hp / e.maxHp, 0, 1);
}

export function enemySpeedFactor(kind: EnemyKind): number {
  void kind;
  return rand(0.92, 1.08);
}
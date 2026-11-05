/**
 * 手势与战斗逻辑单测（纯函数，无需浏览器）。
 * 运行：node --experimental-strip-types scripts/gesture-check.mts
 * 或：npm run test:games
 */
import assert from "node:assert/strict";

import {
  aimFromHands,
  fistClosure,
  Hysteresis,
  mapToStage,
  OneEuroFilter,
  palmCenter,
  pinchRatio,
  resolveHandedness,
  handScale,
} from "../src/games/gesture/math.ts";
import { buildSchedule, getWave, waveEnemyCount } from "../src/games/aircraft/waves.ts";
import { difficulty, COMBO, ENEMY, PLAYER, WEAPONS } from "../src/games/aircraft/balance.ts";
import { makeEnemy, makeBullet, updateBullet, shouldCull, hpRatio } from "../src/games/aircraft/entities.ts";
import { circleHit, clamp, clamp01, damp, applyDeadzone, formatScore, normalize } from "../src/games/core/math.ts";

let pass = 0;
let fail = 0;

function ok(name: string, fn: () => void) {
  try {
    fn();
    pass += 1;
    console.log(`[ok] ${name}`);
  } catch (err) {
    fail += 1;
    console.log(`[FAIL] ${name} :: ${(err as Error).message}`);
  }
}

/** 造一只手的 21 点：掌心在 (cx,cy)，scale 控制手大小，pinch/fist 控制姿态 */
function makeHand(cx = 0.5, cy = 0.5, scale = 0.12, pinchOpen = 1, fist = 0): { x: number; y: number; z?: number }[] {
  const lm: { x: number; y: number; z?: number }[] = [];
  for (let i = 0; i < 21; i += 1) lm.push({ x: cx, y: cy, z: 0 });
  // 腕与中指根决定尺度
  lm[0] = { x: cx, y: cy + scale * 1.2 };
  lm[9] = { x: cx, y: cy + scale * 0.2 };
  // 四指根
  lm[5] = { x: cx - scale * 0.5, y: cy + scale * 0.1 };
  lm[13] = { x: cx + scale * 0.5, y: cy + scale * 0.1 };
  lm[17] = { x: cx + scale * 0.9, y: cy + scale * 0.3 };
  // 指尖：fist=1 时贴近掌心，fist=0 时远离（约 1.75 倍尺度）
  const tipDist = (1.75 - fist * 0.95) * scale;
  const tips = [8, 12, 16, 20];
  tips.forEach((t, idx) => {
    lm[t] = { x: cx + (idx - 1.5) * scale * 0.3, y: cy + tipDist };
  });
  // 拇指尖：pinchOpen=0 时贴合食指尖
  const indexTip = lm[8];
  lm[4] = {
    x: indexTip.x - pinchOpen * scale * 1.1,
    y: indexTip.y - pinchOpen * scale * 0.2,
  };
  return lm;
}

// ---------------------------------------------------------------- 几何

ok("palmCenter 取五点均值", () => {
  const lm = makeHand(0.4, 0.6);
  const c = palmCenter(lm);
  assert.ok(Math.abs(c.x - 0.4) < 0.06, `x=${c.x}`);
  assert.ok(Math.abs(c.y - 0.6) < 0.06, `y=${c.y}`);
});

ok("handScale 与手大小成正比", () => {
  const a = handScale(makeHand(0.5, 0.5, 0.1));
  const b = handScale(makeHand(0.5, 0.5, 0.2));
  assert.ok(Math.abs(b / a - 2) < 0.05, `${b}/${a}`);
});

ok("pinchRatio 张开大、捏合小", () => {
  const open = pinchRatio(makeHand(0.5, 0.5, 0.12, 1));
  const closed = pinchRatio(makeHand(0.5, 0.5, 0.12, 0.05));
  assert.ok(open > closed, `${open} > ${closed}`);
  assert.ok(closed < 0.2, `closed=${closed}`);
});

ok("fistClosure 握拳接近 1、张开接近 0", () => {
  const open = fistClosure(makeHand(0.5, 0.5, 0.12, 1, 0));
  const closed = fistClosure(makeHand(0.5, 0.5, 0.12, 1, 1));
  assert.ok(open < 0.2, `open=${open}`);
  assert.ok(closed > 0.8, `closed=${closed}`);
});

ok("距离变化不影响捏合判断（尺度归一）", () => {
  const near = pinchRatio(makeHand(0.5, 0.5, 0.2, 0.3));
  const far = pinchRatio(makeHand(0.5, 0.5, 0.08, 0.3));
  // 手大小不同但姿态相同 → 归一化后差异应该很小
  assert.ok(Math.abs(near - far) < 0.08, `near=${near} far=${far}`);
});

// ---------------------------------------------------------------- 滞回

ok("Hysteresis 只在穿阈值时翻转", () => {
  const h = new Hysteresis(0.3, 0.5);
  assert.equal(h.update(0.6), false);
  assert.equal(h.update(0.31), false, "未低于 enter 不应触发");
  assert.equal(h.update(0.29), true, "低于 enter 触发");
  assert.equal(h.update(0.4), true, "滞回区间内保持");
  assert.equal(h.update(0.51), false, "高于 exit 释放");
  assert.equal(h.update(0.4), false, "回到区间内不重新触发");
  assert.equal(h.update(0.1), true);
});

ok("Hysteresis 在阈值抖动时不产生抖动", () => {
  const h = new Hysteresis(0.3, 0.5);
  h.update(0.2);
  let flips = 0;
  let prev = h.value;
  for (let i = 0; i < 50; i += 1) {
    h.update(i % 2 === 0 ? 0.29 : 0.32);
    if (h.value !== prev) {
      flips += 1;
      prev = h.value;
    }
  }
  assert.equal(flips, 0, `flips=${flips}`);
});

// ---------------------------------------------------------------- 平滑

ok("OneEuroFilter 收敛到稳定值", () => {
  const f = new OneEuroFilter();
  let v = 0;
  for (let i = 0; i < 120; i += 1) v = f.filter(1, 1 / 60);
  assert.ok(Math.abs(v - 1) < 0.02, `v=${v}`);
});

ok("OneEuroFilter 抑制静止抖动", () => {
  const f = new OneEuroFilter(1.2, 0.02);
  let out = 0;
  for (let i = 0; i < 90; i += 1) {
    const noise = i % 2 === 0 ? 0.5 + 0.02 : 0.5 - 0.02;
    out = f.filter(noise, 1 / 60);
  }
  assert.ok(Math.abs(out - 0.5) < 0.01, `out=${out}`);
});

ok("OneEuroFilter 快速移动时跟得上（低延迟）", () => {
  const f = new OneEuroFilter(1.2, 0.02);
  let out = 0;
  for (let i = 0; i < 30; i += 1) out = f.filter(i * 0.05, 1 / 60);
  // 30 帧后（0.5s）应该跟到接近目标，滞后不超过 25%
  const target = 29 * 0.05;
  assert.ok(out > target * 0.75, `out=${out} target=${target}`);
});

// ---------------------------------------------------------------- 坐标映射

ok("mapToStage 镜像翻转 X", () => {
  const a = mapToStage({ x: 0.2, y: 0.5 }, true, 0);
  assert.ok(Math.abs(a.x - 0.8) < 1e-9, `${a.x}`);
  const b = mapToStage({ x: 0.2, y: 0.5 }, false, 0);
  assert.ok(Math.abs(b.x - 0.2) < 1e-9, `${b.x}`);
});

ok("mapToStage 内缩映射区并夹紧到 0~1", () => {
  const mid = mapToStage({ x: 0.5, y: 0.5 }, false, 0.2);
  assert.ok(Math.abs(mid.x - 0.5) < 1e-9, `mid=${mid.x}`);
  const edge = mapToStage({ x: 0.05, y: 0.05 }, false, 0.2);
  assert.equal(edge.x, 0);
  assert.equal(edge.y, 0);
  const far = mapToStage({ x: 0.99, y: 1 }, false, 0.2);
  assert.equal(far.x, 1);
  assert.equal(far.y, 1);
});

ok("aimFromHands 在正下方时朝正上方", () => {
  const aim = aimFromHands({ x: 0.5, y: 0.8 }, { x: 0.5, y: 0.9 });
  assert.ok(Math.abs(aim.x) < 1e-6, `x=${aim.x}`);
  assert.ok(aim.y < -0.99, `y=${aim.y}`);
});

ok("aimFromHands 偏角被限制在 ±70°", () => {
  const aim = aimFromHands({ x: 0.5, y: 0.5 }, { x: 1, y: 0.5 });
  const deg = (Math.atan2(aim.y, aim.x) * 180) / Math.PI;
  paddingCheck(deg);
  function paddingCheck(d: number) {
    // 朝上为 -90°，+70° 偏转 → -20°
    assert.ok(d > -21 && d < -19, `deg=${d}`);
  }
});

ok("resolveHandedness 镜像后左右互换", () => {
  assert.deepEqual(resolveHandedness(["Left", "Right"], false), ["Left", "Right"]);
  assert.deepEqual(resolveHandedness(["Left", "Right"], true), ["Right", "Left"]);
  assert.deepEqual(resolveHandedness(["Unknown"], true), ["Unknown"]);
});

// ---------------------------------------------------------------- 基础数学

ok("clamp / clamp01 / damp 边界正确", () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-5, 0, 3), 0);
  assert.equal(clamp01(1.5), 1);
  assert.equal(damp(0, 10, 0, 1), 10, "halfLife=0 直接到目标");
  const half = damp(0, 1, 0.5, 0.5);
  assert.ok(Math.abs(half - 0.5) < 1e-9, `half=${half}`);
});

ok("applyDeadzone 中心归零、边缘到 1", () => {
  assert.equal(applyDeadzone(0.1, 0.2), 0);
  assert.equal(applyDeadzone(0.9, 0.2), 1);
  const mid = applyDeadzone(0.5, 0.2);
  assert.ok(mid > 0.3 && mid < 0.7, `${mid}`);
});

ok("normalize 处理零向量", () => {
  const n = normalize(0, 0);
  assert.equal(n.len, 0);
  assert.deepEqual({ x: n.x, y: n.y }, { x: 0, y: -1 });
  const u = normalize(3, 4);
  assert.ok(Math.abs(u.len - 5) < 1e-9);
  assert.ok(Math.abs(u.x - 0.6) < 1e-9);
});

ok("circleHit 用平方距离判定", () => {
  assert.equal(circleHit(0, 0, 5, 9, 0, 4), true, "刚好相切 9<=9");
  assert.equal(circleHit(0, 0, 5, 10, 0, 4), false);
});

ok("formatScore 补零到 6 位", () => {
  assert.equal(formatScore(0), "000000");
  assert.equal(formatScore(1234), "001234");
  assert.equal(formatScore(-3), "000000");
});

// ---------------------------------------------------------------- 波次

ok("第 5 / 10 波是 Boss 波", () => {
  assert.equal(getWave(5).boss, true);
  assert.equal(getWave(10).boss, true);
  assert.equal(getWave(4).boss, false);
  assert.equal(getWave(11).boss, false);
  assert.equal(getWave(15).boss, true, "无限模式每 5 波一个 Boss");
});

ok("波次 1~10 都有敌人（Boss 波除外）", () => {
  for (let i = 1; i <= 10; i += 1) {
    const w = getWave(i);
    if (w.boss) continue;
    assert.ok(waveEnemyCount(w) > 0, `wave ${i} 没有敌人`);
  }
});

ok("buildSchedule 按时间升序且数量一致", () => {
  const w = getWave(3);
  const plan = buildSchedule(w);
  assert.equal(plan.length, waveEnemyCount(w));
  for (let i = 1; i < plan.length; i += 1) {
    assert.ok(plan[i].at >= plan[i - 1].at, `乱序 @${i}`);
  }
});

ok("无限模式敌人数量随波次增长但有上限", () => {
  const w11 = getWave(11);
  const w31 = getWave(31);
  assert.ok(waveEnemyCount(w31) >= waveEnemyCount(w11), "后期不应更简单");
  assert.ok(waveEnemyCount(w31) < 60, `wave31=${waveEnemyCount(w31)}`);
});

ok("同一个波次定义是稳定的（可复现）", () => {
  const a = buildSchedule(getWave(7));
  const b = buildSchedule(getWave(7));
  assert.deepEqual(a, b);
});

// ---------------------------------------------------------------- 数值

ok("难度曲线单调不减且封顶", () => {
  let prevHp = 0;
  let prevSpeed = 0;
  for (let w = 1; w <= 50; w += 1) {
    const d = difficulty(w);
    assert.ok(d.hp >= prevHp, `hp 递减 @${w}`);
    assert.ok(d.speed >= prevSpeed - 1e-9, `speed 递减 @${w}`);
    prevHp = d.hp;
    prevSpeed = d.speed;
  }
  assert.ok(difficulty(100).speed <= 1.9, "速度有上限");
  assert.ok(difficulty(100).spawnRate <= 2.4, "刷怪率有上限");
});

ok("武器等级越高火力越强", () => {
  for (let i = 1; i < WEAPONS.length; i += 1) {
    const prev = WEAPONS[i - 1];
    const cur = WEAPONS[i];
    assert.ok(cur.count >= prev.count, `lv${i + 1} 弹道更少`);
    assert.ok(cur.cooldown <= prev.cooldown, `lv${i + 1} 射速更慢`);
  }
});

ok("连击上限与窗口合理", () => {
  assert.ok(COMBO.maxMultiplier >= 4 && COMBO.maxMultiplier <= 10);
  assert.ok(COMBO.window > 1 && COMBO.window < 4, "窗口太长会无限连");
});

ok("Boss 血量显著高于普通敌人", () => {
  assert.ok(ENEMY.boss.hp > ENEMY.heavy.hp * 8);
});

ok("玩家有 3 条命且有无敌时间", () => {
  assert.equal(PLAYER.maxLives, 3);
  assert.ok(PLAYER.hitInvuln > 0.5 && PLAYER.hitInvuln < 3);
});

// ---------------------------------------------------------------- 实体

ok("makeEnemy 按 hpScale 缩放血量", () => {
  const e1 = makeEnemy("small", 100, -50, 1, 1);
  const e2 = makeEnemy("small", 100, -50, 2, 1);
  assert.equal(e2.hp, e1.hp * 2);
  assert.equal(hpRatio(e1), 1);
});

ok("makeEnemy 血量至少为 1", () => {
  const e = makeEnemy("small", 0, 0, 0.01, 1);
  assert.ok(e.hp >= 1, `hp=${e.hp}`);
});

ok("Boss 初始 hpRatio 为 1，受伤后降低", () => {
  const b = makeEnemy("boss", 270, -140, 1, 1);
  assert.equal(hpRatio(b), 1);
  b.hp = b.maxHp * 0.4;
  assert.ok(Math.abs(hpRatio(b) - 0.4) < 1e-9);
});

ok("子弹飞出屏幕后被标记回收", () => {
  const b = makeBullet(270, 900, 0, 900, true);
  for (let i = 0; i < 10; i += 1) updateBullet(b, 1 / 60);
  assert.equal(b.dead, true);
});

ok("玩家子弹朝上飞出顶部会被回收", () => {
  const b = makeBullet(270, 10, 0, -900, true);
  for (let i = 0; i < 5; i += 1) updateBullet(b, 1 / 60);
  assert.equal(b.dead, true);
});

ok("shouldCull 只回收出界敌机，不回收 Boss", () => {
  const small = makeEnemy("small", 100, 1200, 1, 1);
  assert.equal(shouldCull(small), true);
  const boss = makeEnemy("boss", 270, -140, 1, 1);
  assert.equal(shouldCull(boss), false, "Boss 不能因位置被回收");
});

ok("敌机初始位置在画布上方（屏幕外）", () => {
  const e = makeEnemy("small", 270, -60, 1, 1);
  assert.ok(e.y < 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

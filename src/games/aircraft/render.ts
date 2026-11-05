/**
 * 场景渲染：与更新逻辑分离，便于单独调整视觉而不动玩法。
 * 所有绘制都基于 540×960 逻辑坐标，缩放由画布变换负责。
 */
import { ENEMY, PLAYER, STAGE_H, STAGE_W } from "./balance";
import { hpRatio, type Enemy } from "./entities";
import type { AircraftGame } from "./game";
import { clamp, TAU } from "../core/math";

export interface RenderState {
  sprites: {
    player?: HTMLCanvasElement;
    enemySmall?: HTMLCanvasElement;
    enemyZig?: HTMLCanvasElement;
    enemyHeavy?: HTMLCanvasElement;
    boss?: HTMLCanvasElement;
    nebula?: HTMLCanvasElement;
    glowPlayer: HTMLCanvasElement;
    glowGold: HTMLCanvasElement;
  };
}

/** 抖动位移：拆成小函数，避免在绘图调用里直接写随机表达式。 */
function jitterX(amount: number): number {
  return (Math.random() * 2 - 1) * amount;
}

export function drawScene(ctx: CanvasRenderingContext2D, g: AircraftGame, state: RenderState) {
  const W = STAGE_W;
  const H = STAGE_H;
  const spr = state.sprites;

  ctx.save();
  drawBackground(ctx, spr, g.nebulaOffset, W, H);
  g.stars.render(ctx);

  if (g.shake > 0.4) {
    const s = g.shake * 0.4;
    ctx.translate(jitterX(s), jitterX(s));
  }

  drawPickups(ctx, g, spr);
  drawEnemies(ctx, g, spr);
  drawBullets(ctx, g);
  drawPlayer(ctx, g, spr);
  g.particles.render(ctx);
  drawBossBar(ctx, g);

  ctx.restore();

  if (g.flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.55, g.flash * 1.2);
    ctx.fillStyle = "#dff6ff";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  drawBanner(ctx, g);
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  spr: RenderState["sprites"],
  offset: number,
  W: number,
  H: number,
) {
  const neb = spr.nebula;
  if (!neb) {
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, "#070b1a");
    grd.addColorStop(0.6, "#0a1230");
    grd.addColorStop(1, "#05070f");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  const scale = Math.max(W / neb.width, H / neb.height) * 1.12;
  const dw = neb.width * scale;
  const dh = neb.height * scale;
  const drift = (offset % dh) - dh;
  const x = (W - dw) / 2;
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.drawImage(neb, x, drift, dw, dh);
  ctx.drawImage(neb, x, drift + dh, dw, dh);
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, g: AircraftGame, spr: RenderState["sprites"]) {
  if (g.invuln > 0 && g.lives > 0) {
    // 无敌期间闪烁：按 10Hz 交替显隐
    const phase = Math.floor(g.invuln * 10) % 2;
    if (phase === 0) return;
  }
  ctx.save();
  ctx.translate(g.px, g.py);
  const tilt = Math.atan2(g.aim.x, -g.aim.y);
  ctx.rotate(clamp(tilt, -0.28, 0.28));

  if (spr.player) {
    ctx.drawImage(spr.player, -PLAYER.drawW / 2, -PLAYER.drawH / 2, PLAYER.drawW, PLAYER.drawH);
  } else {
    drawPlayerVector(ctx);
  }

  if (g.shield > 0) {
    const pulse = 0.6 + Math.sin(g.elapsed * 8) * 0.15;
    const alpha = g.shield < 1.5 ? Math.max(0, g.shield / 1.5) * 0.8 : 0.8;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#7fd8ff";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, 34 * pulse + 6, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawEnemies(ctx: CanvasRenderingContext2D, g: AircraftGame, spr: RenderState["sprites"]) {
  for (const e of g.enemies) {
    if (e.dead) continue;
    const def = ENEMY[e.kind];
    const img = spriteFor(spr, e);
    ctx.save();
    ctx.translate(e.x, e.y);
    // Boss 贴图是「朝下」，其余敌人贴图统一旋转成面向玩家
    if (e.kind !== "boss") ctx.rotate(Math.PI);

    if (img) {
      ctx.drawImage(img, -def.drawW / 2, -def.drawH / 2, def.drawW, def.drawH);
      if (e.flash > 0) {
        ctx.globalAlpha = Math.min(0.75, e.flash * 8);
        ctx.globalCompositeOperation = "lighter";
        ctx.drawImage(img, -def.drawW / 2, -def.drawH / 2, def.drawW, def.drawH);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }
    } else {
      drawEnemyVector(ctx, e, def.drawW);
    }

    if (e.kind === "heavy" || e.kind === "turret") {
      const w = def.drawW * 0.7;
      const ratio = hpRatio(e);
      const barY = -def.drawH / 2 - 8;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(-w / 2, barY, w, 3);
      ctx.fillStyle = ratio > 0.5 ? "#ffcf6b" : "#ff6b6b";
      ctx.fillRect(-w / 2, barY, w * ratio, 3);
    }
    ctx.restore();
  }
}

function spriteFor(spr: RenderState["sprites"], e: Enemy): HTMLCanvasElement | undefined {
  switch (e.kind) {
    case "small":
      return spr.enemySmall;
    case "zig":
      return spr.enemyZig;
    case "heavy":
    case "turret":
      return spr.enemyHeavy;
    case "boss":
      return spr.boss;
    default:
      return undefined;
  }
}

function drawBullets(ctx: CanvasRenderingContext2D, g: AircraftGame) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const b of g.bullets) {
    if (b.dead) continue;
    const isPlayer = b.friendly;
    const tx = b.x - b.vx * 0.012;
    const ty = b.y - b.vy * 0.012;
    const grd = ctx.createLinearGradient(tx, ty, b.x, b.y);
    grd.addColorStop(0, "rgba(120,220,255,0)");
    grd.addColorStop(1, isPlayer ? "rgba(190,245,255,0.9)" : "rgba(255,140,150,0.9)");
    ctx.strokeStyle = grd;
    ctx.lineWidth = isPlayer ? 3.4 : 4;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.fillStyle = isPlayer ? "#eafcff" : "#ffd9de";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.75, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawPickups(ctx: CanvasRenderingContext2D, g: AircraftGame, spr: RenderState["sprites"]) {
  for (const p of g.pickups) {
    if (p.dead) continue;
    const color = p.kind === "power" ? "#7fe3ff" : p.kind === "shield" ? "#a4ffcf" : "#ffd166";
    const label = p.kind === "power" ? "P" : p.kind === "shield" ? "S" : "B";
    const pulse = 1 + Math.sin(p.age * 6) * 0.08;
    const glow = p.kind === "bomb" ? spr.glowGold : spr.glowPlayer;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(pulse, pulse);
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(glow, -34, -34, 68, 68);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(6,12,24,0.72)";
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = "bold 14px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, 1);
    ctx.restore();
  }
}

function drawBossBar(ctx: CanvasRenderingContext2D, g: AircraftGame) {
  if (!g.boss) return;
  const ratio = hpRatio(g.boss);
  const w = STAGE_W * 0.7;
  const x = (STAGE_W - w) / 2;
  const y = 26;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(x - 2, y - 2, w + 4, 12);
  const grd = ctx.createLinearGradient(x, 0, x + w, 0);
  grd.addColorStop(0, "#ff4d6d");
  grd.addColorStop(1, "#ffb347");
  ctx.fillStyle = grd;
  ctx.fillRect(x, y, w * ratio, 8);
  ctx.restore();
}

function drawBanner(ctx: CanvasRenderingContext2D, g: AircraftGame) {
  if (g.bannerTime <= 0 || !g.bannerText) return;
  const t = g.bannerTime / 1.6;
  const alpha = t > 0.75 ? (1 - t) / 0.25 : Math.min(1, t / 0.35);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = "#eaf8ff";
  ctx.font = "bold 30px -apple-system, 'PingFang SC', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(120,220,255,0.9)";
  ctx.shadowBlur = 18;
  ctx.fillText(g.bannerText, STAGE_W / 2, STAGE_H * 0.42);
  ctx.restore();
}

function drawPlayerVector(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.fillStyle = "#dff3ff";
  ctx.strokeStyle = "#63d3ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(10, -6);
  ctx.lineTo(24, 6);
  ctx.lineTo(9, 8);
  ctx.lineTo(6, 22);
  ctx.lineTo(0, 18);
  ctx.lineTo(-6, 22);
  ctx.lineTo(-9, 8);
  ctx.lineTo(-24, 6);
  ctx.lineTo(-10, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawEnemyVector(ctx: CanvasRenderingContext2D, e: Enemy, size: number) {
  const s = size / 2;
  ctx.save();
  ctx.fillStyle = e.kind === "heavy" ? "#ffb27a" : "#ff8a8a";
  ctx.strokeStyle = "#ffd7c2";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, s);
  ctx.lineTo(s * 0.8, 0);
  ctx.lineTo(0, -s * 0.6);
  ctx.lineTo(-s * 0.8, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

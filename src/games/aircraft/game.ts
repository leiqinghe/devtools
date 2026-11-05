/**
 * 飞机大战世界：更新逻辑（渲染拆在 render.ts）。
 * 不依赖 React，页面只负责把 ControlFrame 喂进来。
 */
import {
  BOMB,
  BOSS,
  BULLET,
  COMBO,
  PICKUP,
  PLAYER,
  STAGE_H,
  STAGE_W,
  WEAPONS,
  difficulty,
  type EnemyKind,
} from "./balance";
import {
  makeBullet,
  makeEnemy,
  makePickup,
  resetIds,
  rollDrop,
  shouldCull,
  updateBullet,
  updateEnemy,
  updatePickup,
  hpRatio,
  type Bullet,
  type Enemy,
  type Pickup,
  type PickupKind,
} from "./entities";
import { buildSchedule, getWave } from "./waves";
import { ParticleField, StarField } from "../core/particles";
import { clamp, clamp01, damp, rand } from "../core/math";
import { makeGlow, type SpriteMap } from "../core/sprites";
import type { ControlFrame, GameRunStats } from "../types";
import type { SfxName } from "../core/audio";
import { drawScene, type RenderState } from "./render";

export interface GameCallbacks {
  onSfx?: (name: SfxName) => void;
  onWave?: (wave: number, boss: boolean) => void;
  onGameOver?: (stats: GameRunStats) => void;
  onHud?: (hud: HudState) => void;
}

export interface HudState {
  score: number;
  lives: number;
  bombs: number;
  weapon: number;
  combo: number;
  comboTime: number;
  wave: number;
  bossHp: number;
  bossMaxHp: number;
  shield: boolean;
}

export interface Vec {
  x: number;
  y: number;
}

export class AircraftGame {
  px = STAGE_W / 2;
  py = STAGE_H * PLAYER.startY;
  aim: Vec = { x: 0, y: -1 };
  lives = PLAYER.maxLives;
  invuln = 0;
  shield = 0;
  weaponLevel = 1;
  bombs = 1;

  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  pickups: Pickup[] = [];
  particles = new ParticleField();
  stars = new StarField(120);

  score = 0;
  wave = 1;
  kills = 0;
  combo = 0;
  comboTimer = 0;
  maxCombo = 0;
  elapsed = 0;
  boss: Enemy | null = null;
  bannerText = "";
  bannerTime = 0;

  shake = 0;
  flash = 0;
  nebulaOffset = 0;

  private fireCool = 0;
  private specialPrev = false;
  private spawnQueue: { kind: EnemyKind; at: number; slot?: number; jitter?: number }[] = [];
  private waveClock = 0;
  private waveRest = 0;
  private cb: GameCallbacks;
  private running = false;
  private over = false;
  private hudThrottle = 0;
  private spriteState: RenderState["sprites"];

  constructor(sprites: SpriteMap, cb: GameCallbacks = {}) {
    this.cb = cb;
    this.stars.resize(STAGE_W, STAGE_H);
    this.spriteState = {
      player: sprites.player,
      enemySmall: sprites.enemySmall,
      enemyZig: sprites.enemyZig,
      enemyHeavy: sprites.enemyHeavy,
      boss: sprites.boss,
      nebula: sprites.nebula,
      glowPlayer: makeGlow("rgba(140,235,255,0.95)", 64),
      glowGold: makeGlow("rgba(255,215,120,0.9)", 64),
    };
  }

  start() {
    resetIds();
    this.running = true;
    this.over = false;
    this.beginWave(1);
  }

  stop() {
    this.running = false;
  }

  get isRunning() {
    return this.running && !this.over;
  }

  get isOver() {
    return this.over;
  }

  get currentWave() {
    return this.wave;
  }

  stats(source: GameRunStats["source"] = "pointer"): GameRunStats {
    return {
      score: Math.floor(this.score),
      wave: this.wave,
      maxCombo: this.maxCombo,
      kills: this.kills,
      durationMs: Math.round(this.elapsed * 1000),
      source,
    };
  }

  private beginWave(index: number) {
    this.wave = index;
    const def = getWave(index);
    this.spawnQueue = buildSchedule(def);
    this.waveClock = 0;
    this.waveRest = 0;
    if (def.boss) {
      this.showBanner(`WAVE ${index} · BOSS`);
      const tier = Math.max(0, Math.floor((index - 5) / 5));
      const hpScale = Math.pow(BOSS.hpScale, tier) * (1 + tier * 0.05);
      this.boss = makeEnemy("boss", STAGE_W / 2, -140, hpScale, 1);
      this.enemies.push(this.boss);
      this.cb.onSfx?.("wave");
      this.cb.onWave?.(index, true);
    } else {
      this.showBanner(`WAVE ${index}`);
      this.cb.onWave?.(index, false);
    }
  }

  private showBanner(text: string) {
    this.bannerText = text;
    this.bannerTime = 1.6;
  }

  update(dt: number, control: ControlFrame) {
    if (!this.running || this.over) return;
    this.elapsed += dt;

    this.updatePlayer(dt, control);
    this.updateWave(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updatePickups(dt);
    this.updateCombo(dt);

    this.particles.update(dt);
    this.stars.update(dt, 150);
    this.nebulaOffset += dt * 14;

    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 60);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.6);
    if (this.bannerTime > 0) this.bannerTime = Math.max(0, this.bannerTime - dt);

    this.checkPlayerCollision();

    this.hudThrottle += dt;
    if (this.hudThrottle > 0.1) {
      this.hudThrottle = 0;
      this.cb.onHud?.(this.hud());
    }

    if (this.lives <= 0) this.endGame();
  }

  private updatePlayer(dt: number, control: ControlFrame) {
    if (control.live) {
      const tx = clamp01(control.x) * STAGE_W;
      const ty = clamp01(control.y) * STAGE_H;
      this.px = damp(this.px, tx, PLAYER.followHalfLife, dt);
      this.py = damp(this.py, ty, PLAYER.followHalfLife, dt);
      this.aim = control.source === "hand" ? control.aim : { x: 0, y: -1 };
    }
    this.px = clamp(this.px, 24, STAGE_W - 24);
    this.py = clamp(this.py, 48, STAGE_H - 40);

    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    if (this.shield > 0) this.shield = Math.max(0, this.shield - dt);

    this.fireCool -= dt;
    if (control.fire && this.fireCool <= 0) this.fire();

    if (control.special && !this.specialPrev) this.useBomb();
    this.specialPrev = control.special;

    if (Math.random() < 0.85) this.emitThruster();
  }

  private emitThruster() {
    const jx = rand(-6, 6);
    this.particles.burst(this.px + jx, this.py + 24, {
      count: 1,
      speed: 70,
      life: 0.22,
      size: 2.6,
      color: ["#7fe3ff", "#4fb9ff", "#bff0ff"],
      angle: Math.PI / 2,
      spread: 0.9,
      drag: 3,
    });
  }

  private fire() {
    const w = WEAPONS[Math.min(WEAPONS.length - 1, this.weaponLevel - 1)];
    this.fireCool = w.cooldown;
    const baseAngle = Math.atan2(this.aim.y, this.aim.x);
    const speed = BULLET.playerSpeed;

    const shootOne = (offsetAngle: number, offsetX: number) => {
      const a = baseAngle + offsetAngle;
      this.bullets.push(
        makeBullet(
          this.px + offsetX,
          this.py - 18,
          Math.cos(a) * speed,
          Math.sin(a) * speed,
          true,
          w.dmg,
          "#9ef0ff",
        ),
      );
    };

    if (w.count === 1) {
      shootOne(0, 0);
    } else if (w.count === 2) {
      const off = w.offset ?? 11;
      shootOne(-0.02, -off);
      shootOne(0.02, off);
    } else {
      const half = (w.count - 1) / 2;
      for (let i = 0; i < w.count; i += 1) {
        const t = i - half;
        shootOne(t * w.spread, t * 10);
      }
    }
    this.cb.onSfx?.("shoot");
    this.particles.burst(this.px, this.py - 22, {
      count: 2,
      speed: 40,
      life: 0.12,
      size: 2,
      color: "#cdf6ff",
      angle: -Math.PI / 2,
      spread: 0.7,
      drag: 4,
    });
  }

  private useBomb() {
    if (this.bombs <= 0) return;
    this.bombs -= 1;
    this.flash = BOMB.screenFlash;
    this.shake = BOMB.shake;
    this.cb.onSfx?.("bomb");
    this.particles.ring(this.px, this.py, 46, 520, "#a8f0ff");
    this.bullets = this.bullets.filter((b) => b.friendly);
    for (const e of this.enemies) {
      if (!e.dead) this.damageEnemy(e, BOMB.damage);
    }
  }

  private updateWave(dt: number) {
    if (this.waveRest > 0) {
      this.waveRest -= dt;
      if (this.waveRest <= 0) this.beginWave(this.wave + 1);
      return;
    }

    this.waveClock += dt;
    while (this.spawnQueue.length && this.spawnQueue[0].at <= this.waveClock) {
      const item = this.spawnQueue.shift();
      if (!item) break;
      const diff = difficulty(this.wave);
      const slot = item.slot ?? 0.5;
      const jitter = item.jitter ?? 0.3;
      const nx = clamp01(slot + rand(-jitter, jitter));
      const x = nx * STAGE_W;
      const e = makeEnemy(item.kind, x, -60, diff.hp, diff.speed);
      e.baseX = x;
      this.enemies.push(e);
    }

    const def = getWave(this.wave);
    const alive = this.enemies.filter((e) => !e.dead).length;
    if (this.spawnQueue.length === 0 && alive === 0 && !def.boss) {
      this.waveRest = def.rest;
      this.score += 200 + this.wave * 60;
      this.showBanner(`WAVE ${this.wave} CLEAR`);
    }
  }

  private updateEnemies(dt: number) {
    const shooter = { x: this.px, y: this.py };
    const newBullets: Bullet[] = [];
    for (const e of this.enemies) {
      if (e.dead) continue;
      const ratio = hpRatio(e);
      const interval =
        ratio > BOSS.phase2
          ? BOSS.fireInterval1
          : ratio > BOSS.phase3
            ? BOSS.fireInterval2
            : BOSS.fireInterval3;
      updateEnemy(e, dt, shooter, newBullets, interval);
      if (e.kind !== "boss" && e.y > STAGE_H + 40) {
        e.dead = true;
        this.breakCombo();
      }
    }
    if (newBullets.length) this.bullets.push(...newBullets);
    this.enemies = this.enemies.filter((e) => !e.dead && !shouldCull(e));
  }

  private updateBullets(dt: number) {
    for (const b of this.bullets) {
      if (b.dead) continue;
      updateBullet(b, dt);

      if (b.friendly) {
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Math.abs(b.x - e.x) < e.r + b.r && Math.abs(b.y - e.y) < e.r + b.r) {
            this.damageEnemy(e, b.dmg);
            b.dead = true;
            this.particles.burst(b.x, b.y, {
              count: 3,
              speed: 90,
              life: 0.18,
              size: 2,
              color: "#d9fbff",
              drag: 3,
            });
            break;
          }
        }
      } else if (
        this.invuln <= 0 &&
        Math.abs(b.x - this.px) < PLAYER.hitRadius + b.r &&
        Math.abs(b.y - this.py) < PLAYER.hitRadius + b.r
      ) {
        b.dead = true;
        this.hurtPlayer();
      }
    }
    if (this.bullets.some((b) => b.dead)) {
      this.bullets = this.bullets.filter((b) => !b.dead);
    }
  }

  private updatePickups(dt: number) {
    const reach = PLAYER.radius + PICKUP.radius + 10;
    for (const p of this.pickups) {
      if (p.dead) continue;
      updatePickup(p, dt);
      if (Math.abs(p.x - this.px) < reach && Math.abs(p.y - this.py) < reach) {
        p.dead = true;
        this.applyPickup(p.kind);
      }
    }
    if (this.pickups.some((p) => p.dead)) {
      this.pickups = this.pickups.filter((p) => !p.dead);
    }
  }

  private applyPickup(kind: PickupKind) {
    this.cb.onSfx?.("powerup");
    if (kind === "power") {
      if (this.weaponLevel < WEAPONS.length) {
        this.weaponLevel += 1;
        this.showBanner(`WEAPON LV.${this.weaponLevel}`);
      } else {
        this.score += 300;
        this.showBanner("+300");
      }
    } else if (kind === "shield") {
      this.shield = PICKUP.shieldTime;
      this.showBanner("SHIELD");
    } else {
      this.bombs = Math.min(PICKUP.maxBombs, this.bombs + PICKUP.bombGain);
      this.showBanner("BOMB +1");
    }
  }

  private updateCombo(dt: number) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.breakCombo();
    }
  }

  private breakCombo() {
    this.combo = 0;
    this.comboTimer = 0;
  }

  private damageEnemy(e: Enemy, dmg: number) {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = 0.09;
    this.cb.onSfx?.("hit");
    this.particles.burst(e.x, e.y, {
      count: 3,
      speed: 110,
      life: 0.16,
      size: 2,
      color: ["#ffe6a8", "#ffd166"],
      drag: 3,
    });
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy) {
    if (e.dead) return;
    e.dead = true;
    this.kills += 1;
    this.combo = Math.min(COMBO.maxMultiplier, this.combo + 1);
    this.comboTimer = COMBO.window;
    this.maxCombo = Math.max(this.maxCombo, this.combo);

    const mult = 1 + (this.combo - 1) * 0.25;
    this.score += Math.round(e.score * mult);

    if (e.kind === "boss") {
      this.cb.onSfx?.("bigExplode");
      this.shake = 26;
      this.flash = 0.3;
      this.particles.ring(e.x, e.y, 60, 460, "#ffd08a");
      this.particles.burst(e.x, e.y, {
        count: 60,
        speed: 300,
        life: 1.1,
        size: 4,
        color: ["#ffd08a", "#ff8a6b", "#ff5f7a", "#fff3c4"],
        drag: 1.6,
      });
      this.boss = null;
      this.waveRest = 2.2;
      this.pickups.push(makePickup(e.x, e.y, "power"));
      this.pickups.push(makePickup(e.x - 60, e.y + 20, "bomb"));
      this.pickups.push(makePickup(e.x + 60, e.y + 20, "shield"));
      return;
    }

    this.cb.onSfx?.("explode");
    this.shake = Math.min(12, 3 + e.r * 0.18);
    this.particles.burst(e.x, e.y, {
      count: 14 + Math.round(e.r * 0.3),
      speed: 200,
      life: 0.6,
      size: 3,
      color: ["#ffd08a", "#ff9d6b", "#ff6b8a"],
      drag: 2.2,
    });
    const drop = rollDrop(e.kind);
    if (drop) this.pickups.push(makePickup(e.x, e.y, drop));
  }

  private checkPlayerCollision() {
    if (this.invuln > 0) return;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (
        Math.abs(e.x - this.px) < e.r + PLAYER.hitRadius &&
        Math.abs(e.y - this.py) < e.r + PLAYER.hitRadius
      ) {
        this.hurtPlayer();
        if (e.kind !== "boss") this.damageEnemy(e, 4);
        break;
      }
    }
  }

  private hurtPlayer() {
    if (this.invuln > 0) return;
    if (this.shield > 0) {
      this.shield = 0;
      this.invuln = 0.8;
      this.shake = 10;
      this.cb.onSfx?.("hit");
      this.particles.ring(this.px, this.py, 24, 320, "#9ad9ff");
      return;
    }
    this.lives -= 1;
    this.invuln = PLAYER.hitInvuln;
    this.weaponLevel = Math.max(1, this.weaponLevel - 1);
    this.breakCombo();
    this.shake = 20;
    this.flash = 0.22;
    this.cb.onSfx?.("hurt");
    this.particles.burst(this.px, this.py, {
      count: 24,
      speed: 260,
      life: 0.7,
      size: 3,
      color: ["#9ef0ff", "#ff8a6b", "#ffffff"],
      drag: 2,
    });
    if (this.lives <= 0) this.endGame();
  }

  private endGame() {
    if (this.over) return;
    this.over = true;
    this.running = false;
    this.cb.onSfx?.("gameOver");
    this.cb.onGameOver?.(this.stats());
  }

  hud(): HudState {
    return {
      score: Math.floor(this.score),
      lives: this.lives,
      bombs: this.bombs,
      weapon: this.weaponLevel,
      combo: this.combo,
      comboTime: Math.max(0, Math.min(1, this.comboTimer / COMBO.window)),
      wave: this.wave,
      bossHp: this.boss ? Math.max(0, Math.round(this.boss.hp)) : 0,
      bossMaxHp: this.boss ? this.boss.maxHp : 0,
      shield: this.shield > 0,
    };
  }

  render(ctx: CanvasRenderingContext2D) {
    drawScene(ctx, this, { sprites: this.spriteState });
  }
}

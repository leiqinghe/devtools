/** 粒子系统：爆炸火花、推进尾焰、星空视差。全部用对象池，避免 GC 抖动。 */
import { rand, TAU } from "./math";

export interface Particle {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  /** 是否受阻力影响（火花会减速，尾焰不会） */
  drag: number;
  kind: "spark" | "smoke" | "trail";
}

const MAX_PARTICLES = 480;

export class ParticleField {
  private pool: Particle[] = [];
  private cursor = 0;

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      this.pool.push({
        alive: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        color: "#fff",
        drag: 0,
        kind: "spark",
      });
    }
  }

  private acquire(): Particle {
    for (let i = 0; i < this.pool.length; i += 1) {
      const p = this.pool[(this.cursor + i) % this.pool.length];
      if (!p.alive) {
        this.cursor = (this.cursor + i + 1) % this.pool.length;
        return p;
      }
    }
    // 满了就抢最旧的一个（cursor 位置），保证新特效一定出现
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    return p;
  }

  burst(
    x: number,
    y: number,
    opts: {
      count?: number;
      speed?: number;
      life?: number;
      size?: number;
      color?: string | string[];
      drag?: number;
      kind?: Particle["kind"];
      spread?: number;
      angle?: number;
    } = {},
  ) {
    const count = opts.count ?? 12;
    const speed = opts.speed ?? 160;
    const life = opts.life ?? 0.6;
    const size = opts.size ?? 2.4;
    const drag = opts.drag ?? 2.2;
    const kind = opts.kind ?? "spark";
    const spread = opts.spread ?? TAU;
    const baseAngle = opts.angle ?? 0;

    for (let i = 0; i < count; i += 1) {
      const p = this.acquire();
      const a = baseAngle + rand(-spread / 2, spread / 2);
      const s = speed * rand(0.35, 1);
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.maxLife = life * rand(0.7, 1.3);
      p.life = p.maxLife;
      p.size = size * rand(0.6, 1.4);
      p.color = Array.isArray(opts.color)
        ? opts.color[Math.floor(Math.random() * opts.color.length)]
        : opts.color ?? "#9ae6ff";
      p.drag = drag;
      p.kind = kind;
    }
  }

  /** 环形冲击波：Boss 死亡 / 炸弹 */
  ring(x: number, y: number, count: number, speed: number, color: string) {
    for (let i = 0; i < count; i += 1) {
      const p = this.acquire();
      const a = (i / count) * TAU;
      p.alive = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed;
      p.maxLife = 0.8;
      p.life = 0.8;
      p.size = 3;
      p.color = color;
      p.drag = 1.1;
      p.kind = "spark";
    }
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      if (p.drag > 0) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.pool) {
      if (!p.alive) continue;
      const t = p.life / p.maxLife;
      ctx.globalAlpha = p.kind === "smoke" ? t * 0.35 : t;
      ctx.fillStyle = p.color;
      const s = p.size * (p.kind === "smoke" ? 1 + (1 - t) * 2.2 : t);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.4, s), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  clear() {
    for (const p of this.pool) p.alive = false;
  }

  get activeCount() {
    let n = 0;
    for (const p of this.pool) if (p.alive) n += 1;
    return n;
  }
}

interface Star {
  x: number;
  y: number;
  z: number; // 0~1 视差层次
  size: number;
}

export class StarField {
  private stars: Star[] = [];
  private w = 540;
  private h = 960;

  constructor(count = 110) {
    for (let i = 0; i < count; i += 1) {
      this.stars.push({
        x: Math.random(),
        y: Math.random(),
        z: Math.random(),
        size: rand(0.5, 1.9),
      });
    }
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  update(dt: number, speed = 90) {
    for (const s of this.stars) {
      s.y += ((speed * (0.25 + s.z)) / this.h) * dt;
      if (s.y > 1) {
        s.y -= 1;
        s.x = Math.random();
      }
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const s of this.stars) {
      const a = 0.18 + s.z * 0.62;
      ctx.globalAlpha = a;
      ctx.fillStyle = s.z > 0.7 ? "#cfe9ff" : "#8fa8c8";
      const px = s.x * this.w;
      const py = s.y * this.h;
      // 高速星做拖尾，层次越高拖尾越长
      const trail = 2 + s.z * 8;
      ctx.fillRect(px, py, s.size, s.size + trail);
    }
    ctx.restore();
  }
}

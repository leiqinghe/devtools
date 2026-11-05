/**
 * 合成音效：全部由 WebAudio 振荡器 / 噪声实时生成，不加载任何音频文件。
 * 好处是零素材、零请求；缺点是音色偏电子，正好匹配霓虹科幻风。
 */
export type SfxName =
  | "shoot"
  | "hit"
  | "explode"
  | "bigExplode"
  | "powerup"
  | "bomb"
  | "hurt"
  | "wave"
  | "uiClick"
  | "gameOver";

const VOLUME_KEY = "games:audio-volume";

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private volume = 0.6;
  /** 同帧多次触发同名音效时做节流，避免爆音与 CPU 抖动 */
  private lastPlayed: Record<string, number> = Object.create(null);
  private minInterval: Record<string, number> = {
    shoot: 60,
    hit: 45,
    explode: 40,
    bigExplode: 120,
  };

  constructor() {
    try {
      const saved = localStorage.getItem(VOLUME_KEY);
      if (saved !== null) {
        const v = Number(saved);
        if (Number.isFinite(v)) this.volume = Math.min(1, Math.max(0, v));
      }
    } catch {
      // 隐私模式下读不到，用默认值
    }
  }

  /** 浏览器要求用户手势后才能创建 / 恢复 AudioContext，页面在首次点击时调用。 */
  unlock() {
    this.ensure();
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  private ensure() {
    if (this.ctx) return;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);
    const len = Math.floor(this.ctx.sampleRate * 0.5);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
  }

  get isMuted() {
    return this.muted;
  }

  get currentVolume() {
    return this.volume;
  }

  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    try {
      localStorage.setItem(VOLUME_KEY, String(this.volume));
    } catch {
      // 忽略存储失败
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    return this.muted;
  }

  dispose() {
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }

  private tone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
  ) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + duration);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  private noise(duration: number, gain: number, filterFrom: number, filterTo: number, delay = 0) {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(filterFrom, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, filterTo), t0 + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  play(name: SfxName) {
    if (this.muted) return;
    this.ensure();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") void this.ctx.resume();

    const now = performance.now();
    const min = this.minInterval[name];
    if (min) {
      const last = this.lastPlayed[name] || 0;
      if (now - last < min) return;
      this.lastPlayed[name] = now;
    }

    switch (name) {
      case "shoot":
        this.tone(880, 320, 0.09, "square", 0.05);
        this.tone(1320, 640, 0.06, "triangle", 0.03);
        break;
      case "hit":
        this.tone(420, 180, 0.06, "square", 0.06);
        break;
      case "explode":
        this.noise(0.22, 0.28, 2600, 220);
        this.tone(180, 60, 0.18, "sine", 0.12);
        break;
      case "bigExplode":
        this.noise(0.6, 0.4, 1800, 90);
        this.tone(120, 40, 0.5, "sine", 0.24);
        this.tone(240, 70, 0.35, "sawtooth", 0.09, 0.06);
        break;
      case "powerup":
        this.tone(520, 780, 0.08, "triangle", 0.12);
        this.tone(780, 1180, 0.1, "triangle", 0.1, 0.08);
        break;
      case "bomb":
        this.noise(0.8, 0.35, 3000, 60);
        this.tone(300, 40, 0.7, "sawtooth", 0.16);
        break;
      case "hurt":
        this.tone(260, 70, 0.42, "sawtooth", 0.2);
        this.noise(0.3, 0.2, 900, 120);
        break;
      case "wave":
        this.tone(392, 392, 0.12, "triangle", 0.11);
        this.tone(523, 523, 0.12, "triangle", 0.11, 0.12);
        this.tone(659, 659, 0.2, "triangle", 0.13, 0.24);
        break;
      case "uiClick":
        this.tone(660, 880, 0.05, "square", 0.04);
        break;
      case "gameOver":
        this.tone(440, 220, 0.3, "triangle", 0.14);
        this.tone(330, 165, 0.34, "triangle", 0.13, 0.25);
        this.tone(220, 110, 0.5, "triangle", 0.14, 0.5);
        break;
      default:
        break;
    }
  }
}

/** 全站共用一个实例，避免多个页面重复创建 AudioContext。 */
let shared: Sfx | null = null;

export function getSfx(): Sfx {
  if (!shared) shared = new Sfx();
  return shared;
}

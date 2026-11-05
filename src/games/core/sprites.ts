/**
 * 贴图加载与抠底。
 *
 * AI 生图返回的 PNG 是纯黑背景（该中转站不支持真透明），所以这里在运行时做一次
 * 「边缘泛洪 + 亮度阈值」抠底：从画面四边开始，把与边缘连通的纯黑像素变透明，
 * 机身上的暗部（不与边缘连通）会被保留，比整体 chroma-key 干净。
 *
 * 任何一步失败（404 / 解码失败 / 跨域）都回退到代码绘制的霓虹矢量造型，保证不出现空白。
 */

export type SpriteKey = "player" | "enemySmall" | "enemyZig" | "enemyHeavy" | "boss" | "nebula";

interface SpriteDef {
  key: SpriteKey;
  src: string;
  /** 是否做抠底（背景图不做） */
  keyout: boolean;
}

const BASE = `${import.meta.env.BASE_URL}game-assets/aircraft/sprites/`;

const DEFS: SpriteDef[] = [
  { key: "player", src: `${BASE}player.png`, keyout: true },
  { key: "enemySmall", src: `${BASE}enemy-small.png`, keyout: true },
  { key: "enemyZig", src: `${BASE}enemy-zig.png`, keyout: true },
  { key: "enemyHeavy", src: `${BASE}enemy-heavy.png`, keyout: true },
  { key: "boss", src: `${BASE}boss.png`, keyout: true },
  { key: "nebula", src: `${BASE}nebula.png`, keyout: false },
];

export type SpriteMap = Partial<Record<SpriteKey, HTMLCanvasElement>>;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`图片加载失败: ${src}`));
    img.src = src;
  });
}

/**
 * 边缘泛洪抠底。阈值取「RGB 三通道都低于 threshold」判为背景黑，
 * 用迭代式 BFS（避免深递归爆栈），并把边缘做 1px 羽化，减少锯齿。
 */
export function keyoutBlack(img: HTMLImageElement, threshold = 42): HTMLCanvasElement {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const total = w * h;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const isDark = (idx: number) => {
    const o = idx * 4;
    return px[o] < threshold && px[o + 1] < threshold && px[o + 2] < threshold;
  };

  const push = (idx: number) => {
    if (visited[idx]) return;
    if (!isDark(idx)) return;
    visited[idx] = 1;
    queue[tail++] = idx;
  };

  for (let x = 0; x < w; x += 1) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y += 1) {
    push(y * w);
    push(y * w + w - 1);
  }

  while (head < tail) {
    const idx = queue[head++];
    const x = idx % w;
    const y = (idx / w) | 0;
    if (x > 0) push(idx - 1);
    if (x < w - 1) push(idx + 1);
    if (y > 0) push(idx - w);
    if (y < h - 1) push(idx + w);
  }

  // 背景像素：完全透明；与背景相邻的机身像素：按亮度给一点软化，减锯齿
  for (let idx = 0; idx < total; idx += 1) {
    const o = idx * 4;
    if (visited[idx]) {
      px[o + 3] = 0;
      continue;
    }
    const x = idx % w;
    const y = (idx / w) | 0;
    const edge =
      (x > 0 && visited[idx - 1]) ||
      (x < w - 1 && visited[idx + 1]) ||
      (y > 0 && visited[idx - w]) ||
      (y < h - 1 && visited[idx + w]);
    if (edge) {
      const lum = (px[o] + px[o + 1] + px[o + 2]) / 3;
      px[o + 3] = Math.min(255, Math.round(120 + lum));
    }
  }

  ctx.putImageData(data, 0, 0);
  return canvas;
}

function prepare(img: HTMLImageElement, keyout: boolean): HTMLCanvasElement {
  if (keyout) return keyoutBlack(img);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.drawImage(img, 0, 0);
  return canvas;
}

/** 并行加载全部贴图；单个失败只影响自己（对应造型回退矢量绘制）。 */
export async function loadSprites(onProgress?: (loaded: number, total: number) => void): Promise<SpriteMap> {
  const map: SpriteMap = {};
  let done = 0;
  await Promise.all(
    DEFS.map(async (def) => {
      try {
        const img = await loadImage(def.src);
        map[def.key] = prepare(img, def.keyout);
      } catch {
        // 回退：不写入 map，渲染层用矢量兜底
      } finally {
        done += 1;
        onProgress?.(done, DEFS.length);
      }
    }),
  );
  return map;
}

/** 预渲染一张带外发光的光晕贴图，用于子弹与爆炸的柔光叠加，避免每帧 shadowBlur（很贵）。 */
export function makeGlow(color: string, size = 64): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const r = size / 2;
    const grd = ctx.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0, color);
    grd.addColorStop(0.35, color.replace(/[\d.]+\)$/, "0.45)"));
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
  }
  return canvas;
}

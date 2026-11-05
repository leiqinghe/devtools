// 生成飞机大战贴图：调站内 /api/image-gen（生产环境），落盘到 public/game-assets/aircraft/sprites/
// 用法：node scripts/gen-sprites.mjs [name ...]
// 生图限流 5 次/分，脚本按批串行并留间隔。
import fs from "node:fs";
import path from "node:path";

const API = process.env.SPRITE_API || "https://tools.leiqinghe.cloud/api/image-gen";
const OUT = path.resolve(import.meta.dirname, "../public/game-assets/aircraft/sprites");

const STYLE =
  "video game sprite, top-down orthographic view, centered, symmetrical, " +
  "isolated on a pure solid black background, no background scenery, no shadow on ground, " +
  "no text, no watermark, crisp high contrast edges, neon cyberpunk sci-fi aesthetic";

const SPRITES = [
  {
    name: "player",
    prompt: `A sleek single-seat space fighter jet pointing straight up toward the top of the frame, cyan and white glowing neon outline, dark metallic hull, twin engine exhaust glow at the rear, ${STYLE}`,
  },
  {
    name: "enemy-small",
    prompt: `A small aggressive alien fighter craft pointing straight down toward the bottom of the frame, orange and red glowing accents, sharp angular wings, ${STYLE}`,
  },
  {
    name: "enemy-zig",
    prompt: `A nimble lightweight alien interceptor with swept-back delta wings pointing straight down, magenta and purple glowing trim, ${STYLE}`,
  },
  {
    name: "enemy-heavy",
    prompt: `A heavy armored alien bomber gunship, wide bulky armored hull, pointing straight down, thick plating, yellow-green glowing vents, ${STYLE}`,
  },
  {
    name: "boss",
    prompt: `A huge menacing alien mothership boss with a wide symmetrical hull and glowing red core at the center, intimidating spikes and turrets, facing down, ${STYLE}`,
  },
  {
    name: "nebula",
    prompt:
      "Deep space background, dark navy and deep purple nebula clouds with scattered tiny stars, subtle blue glow, very dark, no planets, no objects, no text, vertical composition",
  },
];

const only = process.argv.slice(2);
const todo = only.length ? SPRITES.filter((s) => only.includes(s.name)) : SPRITES;

fs.mkdirSync(OUT, { recursive: true });

async function genOne(item) {
  const file = path.join(OUT, `${item.name}.png`);
  if (fs.existsSync(file) && !process.env.FORCE) {
    console.log(`[skip] ${item.name} 已存在`);
    return;
  }
  const body = {
    prompt: item.prompt,
    size: "1024x1024",
    n: 1,
    quality: "high",
  };
  console.log(`[gen ] ${item.name} ...`);
  const started = Date.now();
  const resp = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(320_000),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`${item.name}: HTTP ${resp.status} ${JSON.stringify(data).slice(0, 200)}`);
  const b64 = data?.images?.[0];
  if (!b64) throw new Error(`${item.name}: 未返回图片`);
  fs.writeFileSync(file, Buffer.from(b64, "base64"));
  console.log(`[ok  ] ${item.name} ${((Date.now() - started) / 1000).toFixed(0)}s -> ${file}`);
}

const BATCH = 2;
for (let i = 0; i < todo.length; i += BATCH) {
  const slice = todo.slice(i, i + BATCH);
  await Promise.all(slice.map((s) => genOne(s).catch((err) => console.error("[fail]", err.message))));
  if (i + BATCH < todo.length) await new Promise((r) => setTimeout(r, 25_000));
}
console.log("done");

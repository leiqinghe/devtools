// 把 gesture-check.mts 用 esbuild 打包成临时 ESM 再执行。
// 原因：源码用 Vite 风格的无扩展名 import，Node 的 ESM 解析器不接受；
// 打包一次即可绕开，并且顺带验证这些纯逻辑模块能被正常打包。
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(import.meta.dirname, "..");
const entry = path.join(root, "scripts/gesture-check.mts");
const outfile = path.join(root, "node_modules/.tmp/gesture-check.mjs");

fs.mkdirSync(path.dirname(outfile), { recursive: true });

await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  logLevel: "warning",
});

const res = spawnSync(process.execPath, [outfile], { stdio: "inherit" });
process.exit(res.status ?? 1);

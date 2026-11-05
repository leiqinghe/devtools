// 从 src/data/tools.tsx 提取工具清单，重写 server/chat-tools.js 的 TOOL_CATALOG。
// 用法：node scripts/sync-tool-catalog.mjs
// 新增/修改站内工具后跑一次，保证机器人推荐的工具名与路径不过期。
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const srcPath = path.join(root, "src/data/tools.tsx");
const outPath = path.join(root, "server/chat-tools.js");

const src = fs.readFileSync(srcPath, "utf8");

// 匹配 { path: "/xxx", Icon: Xxx, title: "标题", desc: "描述" }
const re = /\{\s*path:\s*"([^"]+)"\s*,\s*Icon:\s*[\w.]+\s*,\s*title:\s*"([^"]+)"\s*,\s*desc:\s*"([^"]+)"\s*\}/g;
const tools = [];
let m;
while ((m = re.exec(src))) {
  tools.push({ path: m[1], title: m[2], desc: m[3] });
}

if (tools.length === 0) {
  console.error("未从 tools.tsx 提取到任何工具，请检查格式是否变化");
  process.exit(1);
}

const body = tools
  .map((t) => `  { path: ${JSON.stringify(t.path)}, title: ${JSON.stringify(t.title)}, desc: ${JSON.stringify(t.desc)} },`)
  .join("\n");

const out = `// 站内工具清单（供对话机器人推荐工具用）。
// 由 scripts/sync-tool-catalog.mjs 从 src/data/tools.tsx 生成，请勿手改。
export const TOOL_CATALOG = [
${body}
];

export function buildToolCatalogPrompt() {
  const lines = TOOL_CATALOG.map((t) => \`- \${t.title}：\${t.desc}（\${t.path}）\`);
  return [
    "站内可用的在线工具清单（推荐工具时请使用）:",
    ...lines,
    "",
    "输出规范：当回答中推荐站内工具时，必须用 markdown 相对链接格式 \`[工具名](/path)\`，" +
      "例如 \`[JSON 格式化](/json-format)\`。前端会把它渲染成可点击的工具卡片。" +
      "只使用上面清单里出现过的 path，不要编造站内地址。",
  ].join("\\n");
}

// 供 widget 拉取工具元数据（用于卡片副标题），不含任何敏感信息
export function getToolMeta() {
  return TOOL_CATALOG.map((t) => ({ path: t.path, title: t.title, desc: t.desc }));
}
`;

fs.writeFileSync(outPath, out, "utf8");
console.log(`已同步 ${tools.length} 个工具 -> ${path.relative(root, outPath)}`);

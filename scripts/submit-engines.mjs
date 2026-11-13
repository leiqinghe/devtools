// 部署后主动向搜索引擎推送站点 URL：
//   baidu    百度搜索资源平台「普通收录」API（需 token，见下）
//   indexnow IndexNow 协议（Bing/Yandex/Seznam/Naver 共用，免注册，key 文件自托管）
// 用法：
//   npm run submit:engines            # 全部渠道
//   npm run submit:engines -- baidu   # 仅百度
//   npm run submit:engines -- indexnow
// 环境变量：
//   BAIDU_PUSH_TOKEN  百度搜索资源平台(ziyuan.baidu.com) -> 普通收录 -> 推送接口 token
// 说明：百度的「自动推送 JS」已于 2023 年下线，API 主动推送是当前官方收录通道。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(import.meta.dirname, "..");
const config = JSON.parse(fs.readFileSync(path.join(root, "public/site.config.json"), "utf8"));
const SITE = String(config.siteUrl || "").replace(/\/+$/, "");

function assertPublicSite(u) {
  const url = new URL(u);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`仅允许 http/https，收到 ${url.protocol}`);
  }
  const h = url.hostname.toLowerCase();
  const privateLike =
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h === "0.0.0.0" ||
    /^\[?::1\]?$/.test(h) ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h);
  if (privateLike) {
    throw new Error(`站点地址不能是本机/私有/保留地址：${h}`);
  }
  return url;
}

const siteUrl = assertPublicSite(SITE);
const host = siteUrl.hostname;

const source = fs.readFileSync(path.join(root, "src/data/tools.tsx"), "utf8");
const toolRe = /\{\s*path:\s*"([^"]+)"\s*,\s*Icon:\s*[\w.]+\s*,\s*title:\s*"([^"]+)"\s*,\s*desc:\s*"([^"]+)"\s*\}/g;
const urls = [`${SITE}/`];
let m;
while ((m = toolRe.exec(source))) urls.push(`${SITE}${m[1]}`);
if (urls.length === 1) {
  console.error("未从 tools.tsx 解析到工具，请检查条目格式");
  process.exit(1);
}

const channels = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const want = (name) => channels.length === 0 || channels.includes(name);

// --only /,/json-format,/timestamp ：只推送指定路径（配额不足时分批推）
const onlyIdx = process.argv.indexOf("--only");
const onlyPaths = onlyIdx >= 0 ? (process.argv[onlyIdx + 1] || "").split(",").map((s) => s.trim()).filter(Boolean) : null;
let pushList = urls;
if (onlyPaths) {
  pushList = urls.filter((u) => {
    const p = new URL(u).pathname;
    return onlyPaths.includes(p === "/" ? "/" : p.replace(/\/+$/, ""));
  });
  if (pushList.length === 0) {
    console.error("--only 未匹配到任何 URL，可用路径示例：/");
    process.exit(1);
  }
}

async function pushBaidu() {
  const token = process.env.BAIDU_PUSH_TOKEN;
  if (!token) {
    console.log("[baidu] 跳过：未设置 BAIDU_PUSH_TOKEN（百度搜索资源平台 -> 普通收录 -> 推送接口）");
    return;
  }
  const endpoint = assertPublicSite(`http://data.zz.baidu.com/urls?site=${host}&token=${token}`);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: pushList.join("\n"),
  });
  const text = await res.text();
  console.log(`[baidu] HTTP ${res.status} ${text}`);
}

async function pushIndexNow() {
  const keyFile = path.join(root, "public/indexnow-key.txt");
  let key = "";
  if (fs.existsSync(keyFile)) {
    key = fs.readFileSync(keyFile, "utf8").trim();
  }
  if (!key) {
    key = crypto.randomBytes(16).toString("hex");
    fs.writeFileSync(keyFile, key);
    console.log(`[indexnow] 生成新 key -> public/indexnow-key.txt（下次部署后生效）`);
  }
  const endpoint = assertPublicSite("https://api.indexnow.org/indexnow");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key,
      keyLocation: `${SITE}/indexnow-key.txt`,
      urlList: pushList,
    }),
  });
  const text = await res.text();
  console.log(`[indexnow] HTTP ${res.status} ${text || res.statusText}（202=已受理 200=已提交 4xx=检查 key/URL）`);
}

if (want("baidu")) await pushBaidu();
if (want("indexnow")) await pushIndexNow();
console.log(`已推送 ${pushList.length} 个 URL（${host}）。首次使用请先完成站长平台验证并部署最新 dist。`);

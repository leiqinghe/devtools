import { Router } from "express";
import { validateOutboundUrl } from "./url-guard.js";
import { generateImages, UpstreamError } from "./image-gen-client.js";

const router = Router();

// 配置仅来自服务端环境变量（管理员配置），不使用任何用户输入构造 URL；
// 出站请求统一经 image-gen-client -> url-guard 完成校验。
const IMAGE_GEN_BASE_URL = (process.env.IMAGE_GEN_BASE_URL || "").replace(/\/+$/, "");
const IMAGE_GEN_API_KEY = process.env.IMAGE_GEN_API_KEY || "";
const IMAGE_GEN_MODEL = process.env.IMAGE_GEN_MODEL || "gpt-image-1";
const IMAGE_GEN_RATE_LIMIT = Math.max(1, parseInt(process.env.IMAGE_GEN_RATE_LIMIT || "5", 10));
const IMAGE_GEN_TIMEOUT_MS = Math.max(30000, parseInt(process.env.IMAGE_GEN_TIMEOUT_MS || "300000", 10));
const MAX_PROMPT_LENGTH = 4000;

const ALLOWED_SIZES = new Set(["auto", "1024x1024", "1536x1024", "1024x1536"]);
const ALLOWED_QUALITIES = new Set(["low", "medium", "high"]);

let IMAGE_GEN_ALLOWED_HOSTS = [];
try {
  const rawHosts =
    process.env.IMAGE_GEN_ALLOWED_HOSTS ||
    (IMAGE_GEN_BASE_URL ? new URL(IMAGE_GEN_BASE_URL).hostname : "");
  IMAGE_GEN_ALLOWED_HOSTS = rawHosts
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
} catch {
  IMAGE_GEN_ALLOWED_HOSTS = [];
}

const genRateMap = new Map();

router.post("/api/image-gen", async (req, res) => {
  if (!IMAGE_GEN_BASE_URL || !IMAGE_GEN_API_KEY) {
    return res.status(503).json({ error: "生图服务未配置，请联系管理员" });
  }
  const guard = validateOutboundUrl(IMAGE_GEN_BASE_URL);
  if (!guard.ok || !IMAGE_GEN_ALLOWED_HOSTS.includes(guard.host)) {
    return res.status(503).json({ error: "生图服务地址配置无效" });
  }

  // 简单 IP 限流（内存滑动窗口，1 分钟）
  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "unknown";
  const now = Date.now();
  const hits = (genRateMap.get(ip) || []).filter((t) => t > now - 60000);
  if (hits.length >= IMAGE_GEN_RATE_LIMIT) {
    return res.status(429).json({
      error: `请求太频繁，每分钟最多 ${IMAGE_GEN_RATE_LIMIT} 次，请稍后再试`,
    });
  }
  hits.push(now);
  genRateMap.set(ip, hits);

  // 入参白名单校验
  const { prompt, size, n, quality } = req.body || {};
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return res.status(400).json({ error: "请输入提示词" });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({ error: `提示词不能超过 ${MAX_PROMPT_LENGTH} 字` });
  }
  const cleanPrompt = prompt.trim();
  const genSize = typeof size === "string" && ALLOWED_SIZES.has(size) ? size : "auto";
  const genQuality = typeof quality === "string" && ALLOWED_QUALITIES.has(quality) ? quality : "";
  const genN = Math.min(Math.max(parseInt(n, 10) || 1, 1), 4);

  try {
    const { images, model } = await generateImages({
      baseUrl: IMAGE_GEN_BASE_URL,
      allowedHosts: IMAGE_GEN_ALLOWED_HOSTS,
      apiKey: IMAGE_GEN_API_KEY,
      model: IMAGE_GEN_MODEL,
      prompt: cleanPrompt,
      size: genSize,
      n: genN,
      quality: genQuality,
      timeoutMs: IMAGE_GEN_TIMEOUT_MS,
    });
    res.json({ images, model });
  } catch (err) {
    if (err instanceof UpstreamError) {
      return res.status(502).json({ error: err.message });
    }
    if (err?.code === "EGUARD") {
      return res.status(503).json({ error: "生图服务地址校验未通过，请检查配置" });
    }
    if (err?.name === "AbortError") {
      return res.status(504).json({ error: "生成超时，请重试或缩短提示词" });
    }
    res.status(502).json({ error: "生图服务连接失败，请稍后再试" });
  }
});

export default router;

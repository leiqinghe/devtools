import { Router } from "express";
import multer from "multer";
import { editImages, UpstreamError } from "./image-gen-edits-client.js";

const router = Router();
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ALLOWED_SIZES = new Set(["auto", "1024x1024", "1536x1024", "1024x1536"]);
const IMAGE_GEN_TIMEOUT_MS = Math.max(30000, parseInt(process.env.IMAGE_GEN_TIMEOUT_MS || "300000", 10));
const IMAGE_GEN_RATE_LIMIT = Math.max(1, parseInt(process.env.IMAGE_GEN_RATE_LIMIT || "5", 10));
const MAX_PROMPT_LENGTH = 4000;

// 配置仅来自服务端环境变量（管理员配置），模块级常量；
// 出站请求统一经 image-gen-edits-client -> url-guard 完成协议/主机白名单/私网段/DNS 预解析校验。
const IMAGE_GEN_BASE_URL = (process.env.IMAGE_GEN_BASE_URL || "").replace(/\/+$/, "");
const IMAGE_GEN_API_KEY = process.env.IMAGE_GEN_API_KEY || "";
const IMAGE_GEN_MODEL = process.env.IMAGE_GEN_MODEL || "gpt-image-1";

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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 4 },
});

// 与文生图同策略的独立限流（每 IP 每分钟）
const rateMap = new Map();

router.post("/api/image-gen/edits", upload.array("images", 4), async (req, res) => {
  if (!IMAGE_GEN_BASE_URL || !IMAGE_GEN_API_KEY) {
    return res.status(503).json({ error: "生图服务未配置，请联系管理员" });
  }
  if (IMAGE_GEN_ALLOWED_HOSTS.length === 0) {
    return res.status(503).json({ error: "生图服务地址配置无效" });
  }

  // 限流（每 IP 每分钟）
  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "unknown";
  const now = Date.now();
  const hits = (rateMap.get(ip) || []).filter((t) => t > now - 60000);
  if (hits.length >= IMAGE_GEN_RATE_LIMIT) {
    return res.status(429).json({
      error: `请求太频繁，每分钟最多 ${IMAGE_GEN_RATE_LIMIT} 次，请稍后再试`,
    });
  }
  hits.push(now);
  rateMap.set(ip, hits);

  // 入参校验
  const files = Array.isArray(req.files) ? req.files : [];
  if (files.length === 0) {
    return res.status(400).json({ error: "请至少上传一张参考图" });
  }
  for (const f of files) {
    if (!ALLOWED_IMAGE_TYPES.has(f.mimetype)) {
      return res.status(400).json({ error: "仅支持 PNG / JPG / WebP 图片" });
    }
  }
  const { prompt, size, n } = req.body || {};
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return res.status(400).json({ error: "请输入编辑提示词" });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({ error: `提示词不能超过 ${MAX_PROMPT_LENGTH} 字` });
  }
  const genSize = typeof size === "string" && ALLOWED_SIZES.has(size) ? size : "auto";
  const genN = Math.min(Math.max(parseInt(n, 10) || 1, 1), 4);

  try {
    const result = await editImages({
      baseUrl: IMAGE_GEN_BASE_URL,
      allowedHosts: IMAGE_GEN_ALLOWED_HOSTS,
      apiKey: IMAGE_GEN_API_KEY,
      model: IMAGE_GEN_MODEL,
      prompt: prompt.trim(),
      images: files.map((f) => f.buffer),
      size: genSize,
      n: genN,
      timeoutMs: IMAGE_GEN_TIMEOUT_MS,
    });
    res.json(result);
  } catch (err) {
    if (err instanceof UpstreamError) {
      return res.status(502).json({ error: err.message });
    }
    if (err?.code === "EGUARD") {
      return res.status(503).json({ error: "生图服务地址校验未通过，请检查配置" });
    }
    if (err?.name === "AbortError") {
      return res.status(504).json({ error: "生成超时，请重试" });
    }
    res.status(502).json({ error: "生图服务连接失败，请稍后再试" });
  }
});

export default router;

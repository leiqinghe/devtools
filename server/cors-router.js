import express from "express";

// 跨域中间件：仅供 portfolio 站（跨域）调用 /api/tts、/api/chat 等接口时使用。
// 白名单与 chat-router 保持一致（同一套 env，便于统一维护）；非浏览器请求无 Origin 直接放行。
const ALLOWED_ORIGINS = (
  process.env.CHAT_ALLOWED_ORIGINS ||
  "https://leiqinghe.cloud,https://tools.leiqinghe.cloud,http://101.201.56.200:8100"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const corsPaths = ["/api/tts", "/api/chat"];

export default function corsRouter() {
  const router = express.Router();
  router.use(corsPaths, (req, res, next) => {
    const origin = req.headers.origin;
    if (!origin) return next();
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return res.status(403).json({ error: "来源不被允许" });
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
    return next();
  });
  return router;
}

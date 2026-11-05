import { Router } from "express";
import { validateOutboundUrl } from "./url-guard.js";
import { streamChatCompletion, UpstreamError } from "./chat-client.js";

const router = Router();

// 配置仅来自服务端环境变量（管理员配置），不使用任何用户输入构造 URL；
// 出站请求统一经 chat-client -> url-guard 完成校验。
const CHAT_BASE_URL = (process.env.CHAT_BASE_URL || "").replace(/\/+$/, "");
const CHAT_API_KEY = process.env.CHAT_API_KEY || "";
const CHAT_MODEL = process.env.CHAT_MODEL || "deepseek-v4.1-flash";
// 用户可切换的模型白名单（逗号分隔 id），请求里的 model 必须在名单内。
// glm-5.3-flash 为推理模型：推理阶段仅输出 reasoning_content、耗时长（实测 2 分钟+），暂不对外开放。
const CHAT_MODELS = (process.env.CHAT_MODELS || "deepseek-v4.1-flash")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
const CHAT_RATE_LIMIT = Math.max(1, parseInt(process.env.CHAT_RATE_LIMIT || "10", 10));
const CHAT_TIMEOUT_MS = Math.max(30000, parseInt(process.env.CHAT_TIMEOUT_MS || "120000", 10));
const CHAT_MAX_TOKENS = Math.max(100, parseInt(process.env.CHAT_MAX_TOKENS || "2000", 10));
const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;
// 总长限制保证 JSON 载荷不超过 server.js 的 express.json 64kb 全局上限
const MAX_TOTAL_LENGTH = 16000;

// CORS 白名单：widget 嵌入在工具站（同源）与个人网站（跨域），浏览器端需要放行预检；
// 非浏览器请求不携带 Origin 头，直接放行（CORS 仅约束浏览器行为）。
const ALLOWED_ORIGINS = (
  process.env.CHAT_ALLOWED_ORIGINS ||
  "https://leiqinghe.cloud,https://tools.leiqinghe.cloud,http://101.201.56.200:8100"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

let CHAT_ALLOWED_HOSTS = [];
try {
  const rawHosts =
    process.env.CHAT_ALLOWED_HOSTS ||
    (CHAT_BASE_URL ? new URL(CHAT_BASE_URL).hostname : "");
  CHAT_ALLOWED_HOSTS = rawHosts
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
} catch {
  CHAT_ALLOWED_HOSTS = [];
}

// 系统提示词：站点助手人设。知识库（Phase 2）检索到的上下文在此注入。
const DEFAULT_SYSTEM_PROMPT = [
  "你是「小雷助手」，开发者雷庆贺的个人网站与在线工具集（DevTools）的 AI 助手。",
  "回答简洁、友好、实用，按默认使用中文。",
  "可以介绍站主的技术方向（全栈开发、AI 应用）和站内工具（时间戳转换、二维码、JSON 格式化、图片处理、AI 生图、文件分享等）。",
  "不确定或超出已知范围的内容请如实说明，不要编造。",
].join("");
const SYSTEM_PROMPT = (process.env.CHAT_SYSTEM_PROMPT || "").trim() || DEFAULT_SYSTEM_PROMPT;

// 限流存储：空原型普通对象（防原型污染），键为 IP，值为时间戳数组。
// 用括号访问而非 Map.get（历史扫描误判模式，见 AGENTS.md 经验教训）。
const chatRateStore = Object.create(null);

router.options("/api/chat", (req, res) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: "来源不被允许" });
  }
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
  return res.status(204).end();
});

router.post("/api/chat", async (req, res) => {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: "来源不被允许" });
  }
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  if (!CHAT_BASE_URL || !CHAT_API_KEY) {
    return res.status(503).json({ error: "对话服务未配置，请联系管理员" });
  }
  const guard = validateOutboundUrl(CHAT_BASE_URL);
  if (!guard.ok || !CHAT_ALLOWED_HOSTS.includes(guard.host)) {
    return res.status(503).json({ error: "对话服务地址配置无效" });
  }

  // 简单 IP 限流（内存滑动窗口，1 分钟）
  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "unknown";
  const now = Date.now();
  const cutoff = now - 60000;
  let hits = chatRateStore[ip] || [];
  hits = hits.filter((t) => t > cutoff);
  if (hits.length >= CHAT_RATE_LIMIT) {
    chatRateStore[ip] = hits;
    return res.status(429).json({
      error: `对话太频繁，每分钟最多 ${CHAT_RATE_LIMIT} 次，请稍后再试`,
    });
  }
  hits.push(now);
  chatRateStore[ip] = hits;

  // 入参校验：只接受 user/assistant 两类角色，内容为有限长度字符串
  const { messages, stream, model } = req.body || {};
  const useModel = model ? String(model) : CHAT_MODEL;
  if (!CHAT_MODELS.includes(useModel)) {
    return res.status(400).json({ error: "不支持的模型" });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "缺少对话内容" });
  }
  if (messages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: `对话轮数过多，最多保留 ${MAX_MESSAGES} 条消息` });
  }
  const cleanMessages = [];
  let totalLength = 0;
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") {
      return res.status(400).json({ error: "消息格式不正确" });
    }
    if (m.content.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `单条消息不能超过 ${MAX_MESSAGE_LENGTH} 字` });
    }
    totalLength += m.content.length;
    cleanMessages.push({ role: m.role, content: m.content });
  }
  if (totalLength > MAX_TOTAL_LENGTH) {
    return res.status(400).json({ error: "对话内容过长，请开起新对话" });
  }

  // 知识库接缝（Phase 2）：检索结果在此拼进系统提示词
  const payloadMessages = buildMessages(cleanMessages);
  const useStream = stream !== false;

  // 客户端提前断开时中止上游请求，避免空耗
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    if (useStream) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
      const { content, model } = await streamChatCompletion({
        baseUrl: CHAT_BASE_URL,
        allowedHosts: CHAT_ALLOWED_HOSTS,
        apiKey: CHAT_API_KEY,
        model: useModel,
        messages: payloadMessages,
        maxTokens: CHAT_MAX_TOKENS,
        timeoutMs: CHAT_TIMEOUT_MS,
        stream: true,
        signal: controller.signal,
        onDelta: (delta) => send({ delta }),
      });
      send({ done: true, model });
      return res.end();
    }

    const { content, model } = await streamChatCompletion({
      baseUrl: CHAT_BASE_URL,
      allowedHosts: CHAT_ALLOWED_HOSTS,
      apiKey: CHAT_API_KEY,
      model: useModel,
      messages: payloadMessages,
      maxTokens: CHAT_MAX_TOKENS,
      timeoutMs: CHAT_TIMEOUT_MS,
      stream: false,
      signal: controller.signal,
    });
    return res.json({ content, model });
  } catch (err) {
    if (useStream && res.headersSent) {
      // 流已开始：以 SSE 事件形式报错并收尾
      if (!res.writableEnded) {
        const message =
          err?.name === "AbortError"
            ? "连接中断，请重试"
            : err instanceof UpstreamError
              ? err.message
              : "对话服务连接失败，请稍后再试";
        res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
        res.end();
      }
      return;
    }
    if (err instanceof UpstreamError) {
      return res.status(502).json({ error: err.message });
    }
    if (err?.code === "EGUARD") {
      return res.status(503).json({ error: "对话服务地址校验未通过，请检查配置" });
    }
    if (err?.name === "AbortError") {
      return res.status(504).json({ error: "响应超时，请重试" });
    }
    res.status(502).json({ error: "对话服务连接失败，请稍后再试" });
  }
});

// 系统提示词 + 用户对话。Phase 2 知识库检索结果在此拼进 system 内容。
function buildMessages(userMessages) {
  return [{ role: "system", content: SYSTEM_PROMPT }, ...userMessages];
}

export default router;

import express from "express";
import multer from "multer";
import crypto from "crypto";
import imageGenRouter from "./image-gen-router.js";
import imageGenEditsRouter from "./image-gen-edits-router.js";
import ttsRouter from "./tts-router.js";
import shareCodeRouter from "./share-code-router.js";
import chatRouter from "./chat-router.js";
import corsRouter from "./cors-router.js";

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_SIZE = 500 * 1024 * 1024;
const CHUNK_SIZE = 2 * 1024 * 1024;

const files = new Map();
const uploads = new Map();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
});

app.use(express.json({ limit: "64kb" }));

// 跨域中间件（必须在业务路由之前，见 cors-router.js）
app.use(corsRouter());

// AI 图片生成模块（配置与出站校验见 image-gen-router.js）
app.use(imageGenRouter);
// 图生图（images/edits 转发，见 image-gen-edits-router.js）
app.use(imageGenEditsRouter);
// AI 文字转语音（chat.completions TTS，见 tts-router.js）
app.use(ttsRouter);
// 文件分享 + 快捷分享码（必须挂在下方原 /api/share/upload 之前，见 share-code-router.js）
app.use(shareCodeRouter);
// AI 对话机器人（widget 嵌入两站，SSE 流式，见 chat-router.js）
app.use(chatRouter);

app.post("/api/share/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file data" });
  }
  const fileId = req.body.fileId || crypto.randomBytes(8).toString("hex");
  const partIndex = parseInt(req.body.partIndex || "0", 10);
  const totalParts = parseInt(req.body.totalParts || "1", 10);
  const name = Buffer.from(req.body.name || "file", "latin1").toString("utf8");
  const type = req.body.type || "application/octet-stream";
  const minutes = Math.max(1, Math.min(parseInt(req.body.minutes || "10", 10), 1440));

  let up = uploads.get(fileId);
  if (!up) {
    up = { parts: [], totalParts, name, type, minutes, lastAt: Date.now() };
    uploads.set(fileId, up);
  }
  up.parts[partIndex] = req.file.buffer;
  up.lastAt = Date.now();

  const received = up.parts.filter(Boolean).length;
  if (received >= totalParts) {
    const buffer = Buffer.concat(up.parts);
    const id = crypto.randomBytes(8).toString("hex");
    const ttl = minutes * 60 * 1000;
    const expiresAt = Date.now() + ttl;
    files.set(id, { buffer, name, type, size: buffer.length, expiresAt });
    uploads.delete(fileId);
    res.json({ done: true, id, expiresAt: new Date(expiresAt).toISOString(), size: buffer.length });
  } else {
    res.json({ done: false, received, total: totalParts });
  }
});

app.get("/share/:id", (req, res) => {
  const item = files.get(req.params.id);
  if (!item) {
    return res.status(404).json({ error: "文件不存在或已过期" });
  }
  if (Date.now() > item.expiresAt) {
    files.delete(req.params.id);
    return res.status(404).json({ error: "文件已过期" });
  }

  const total = item.buffer.length;
  const range = req.headers.range;
  // 净化文件名：去除控制符与反斜杠，防响应头注入；引号等由 encodeURIComponent 统一编码
  const filename = String(item.name || "file")
    .replace(/[\r\n\\]/g, "")
    .slice(0, 150);

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", item.type || "application/octet-stream");

  if (range) {
    const match = range.replace(/bytes=/, "").split("-");
    const start = parseInt(match[0], 10);
    const end = match[1] ? parseInt(match[1], 10) : total - 1;
    const safeStart = isNaN(start) || start < 0 ? 0 : Math.min(start, total - 1);
    const safeEnd = isNaN(end) || end >= total ? total - 1 : end;
    if (safeStart > safeEnd) {
      return res.status(416).setHeader("Content-Range", `bytes */${total}`).end();
    }
    res.status(206);
    res.setHeader("Content-Range", `bytes ${safeStart}-${safeEnd}/${total}`);
    res.setHeader("Content-Length", safeEnd - safeStart + 1);
    res.attachment(filename);
    return res.send(item.buffer.subarray(safeStart, safeEnd + 1));
  }

  res.setHeader("Content-Length", total);
  res.attachment(filename);
  res.send(item.buffer);
});

setInterval(() => {
  const now = Date.now();
  for (const [id, item] of files) {
    if (now > item.expiresAt) files.delete(id);
  }
  for (const [id, up] of uploads) {
    if (now - up.lastAt > 30 * 60 * 1000) uploads.delete(id);
  }
}, 60000);

app.listen(PORT, () => {
  console.log(`File share server running on port ${PORT}`);
});

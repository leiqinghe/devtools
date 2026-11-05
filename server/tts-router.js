import { Router } from "express";
import multer from "multer";
import { validateOutboundUrl } from "./url-guard.js";
import { synthesizeSegment, UpstreamError } from "./tts-client.js";

const router = Router();

// 配置仅来自服务端环境变量（管理员配置），不使用任何用户输入构造 URL；
// 出站请求统一经 tts-client -> url-guard 完成校验。
const TTS_BASE_URL = (process.env.TTS_BASE_URL || "https://api.xiaomimimo.com/v1").replace(/\/+$/, "");
const TTS_API_KEY = process.env.TTS_API_KEY || "";
const TTS_MODEL = process.env.TTS_MODEL || "mimo-v2.5-tts";
const TTS_RATE_LIMIT = Math.max(1, parseInt(process.env.TTS_RATE_LIMIT || "5", 10));
const TTS_TIMEOUT_MS = Math.max(30000, parseInt(process.env.TTS_TIMEOUT_MS || "120000", 10));
const TTS_MODEL_DESIGN = process.env.TTS_MODEL_DESIGN || "mimo-v2.5-tts-voicedesign";
const TTS_MODEL_CLONE = process.env.TTS_MODEL_CLONE || "mimo-v2.5-tts-voiceclone";
const MAX_SEGMENTS = 30;
const MAX_SEGMENT_LENGTH = 500;
const MAX_STYLE_LENGTH = 200;
const MAX_DESC_LENGTH = 300;
const MAX_REF_BYTES = 10 * 1024 * 1024;
const PCM_SAMPLE_RATE = 24000;
const SYNTH_CONCURRENCY = 3;

// 音色复刻参考音频：仅 mp3/wav，b64 后 ≤10MB
const refUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_REF_BYTES, files: 30 },
  fileFilter: (_req, file, cb) => {
    const ok = /^(audio\/(mpeg|mp3|wav|x-wav|wave|vnd\.wave))$/.test(file.mimetype);
    cb(null, ok);
  },
});

const ALLOWED_VOICES = new Set(["冰糖", "茉莉", "苏打", "白桦", "Mia", "Chloe", "Milo", "Dean"]);
const DEFAULT_VOICE = "茉莉";

let TTS_ALLOWED_HOSTS = [];
try {
  const rawHosts =
    process.env.TTS_ALLOWED_HOSTS ||
    (TTS_BASE_URL ? new URL(TTS_BASE_URL).hostname : "");
  TTS_ALLOWED_HOSTS = rawHosts
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
} catch {
  TTS_ALLOWED_HOSTS = [];
}

const ttsRateMap = new Map();

// 44 字节标准 PCM WAV 头（单声道 16bit，采样率动态）
function buildWavHeader(dataLength, sampleRate = PCM_SAMPLE_RATE) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);
  return header;
}

// design/clone 模式返回 WAV，解析出裸 PCM 与采样率供拼接
function parseWavToPcm(buf) {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new UpstreamError(502, "音频响应不是有效 WAV");
  }
  let offset = 12;
  let sampleRate = 0;
  let channels = 1;
  let pcm = null;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (size === 0) break;
    if (id === "fmt " && offset + 24 <= buf.length) {
      const fmt = buf.readUInt16LE(offset + 8);
      channels = buf.readUInt16LE(offset + 10);
      sampleRate = buf.readUInt32LE(offset + 12);
      const bits = buf.readUInt16LE(offset + 22);
      if (fmt !== 1 || bits !== 16) {
        throw new UpstreamError(502, "音频格式非 PCM16，暂不支持拼接");
      }
    } else if (id === "data") {
      const end = Math.min(offset + 8 + size, buf.length);
      pcm = buf.subarray(offset + 8, end);
    }
    offset += 8 + size + (size % 2);
  }
  if (!pcm || !sampleRate) {
    throw new UpstreamError(502, "WAV 缺少 fmt/data 块");
  }
  if (channels !== 1) {
    throw new UpstreamError(502, "音频非单声道，暂不支持拼接");
  }
  return { pcm, sampleRate };
}

function pcmSegmentsToWav(pcmBuffers, sampleRate = PCM_SAMPLE_RATE) {
  const pcm = Buffer.concat(pcmBuffers);
  const durationSec = Math.round((pcm.length / 2 / sampleRate) * 10) / 10;
  return {
    audio: Buffer.concat([buildWavHeader(pcm.length, sampleRate), pcm]).toString("base64"),
    durationSec,
  };
}

// 入参白名单校验：segments 数组，每段 { text, mode, voice/voiceDesc/refIdx, style }
function parseSegments(rawSegments) {
  if (typeof rawSegments === "string") {
    try {
      rawSegments = JSON.parse(rawSegments);
    } catch {
      return { error: "分段数据格式错误" };
    }
  }
  if (!Array.isArray(rawSegments) || rawSegments.length === 0) {
    return { error: "请提供待合成的文本分段" };
  }
  if (rawSegments.length > MAX_SEGMENTS) {
    return { error: `分段数不能超过 ${MAX_SEGMENTS} 段` };
  }
  const segments = [];
  for (const seg of rawSegments) {
    const mode = seg?.mode === "design" || seg?.mode === "clone" ? seg.mode : "preset";
    const text = typeof seg?.text === "string" ? seg.text.trim() : "";
    if (!text) {
      return { error: "存在空文本分段，请检查输入" };
    }
    if (text.length > MAX_SEGMENT_LENGTH) {
      return { error: `单段文本不能超过 ${MAX_SEGMENT_LENGTH} 字` };
    }
    const style = typeof seg?.style === "string" ? seg.style.trim() : "";
    if (style.length > MAX_STYLE_LENGTH) {
      return { error: `情感指令不能超过 ${MAX_STYLE_LENGTH} 字` };
    }
    const item = { text, mode, style };
    if (mode === "preset") {
      const voice =
        typeof seg?.voice === "string" && ALLOWED_VOICES.has(seg.voice)
          ? seg.voice
          : DEFAULT_VOICE;
      item.voice = voice;
    } else if (mode === "design") {
      const voiceDesc = typeof seg?.voiceDesc === "string" ? seg.voiceDesc.trim() : "";
      if (!voiceDesc) {
        return { error: "音色设计模式需要填写音色描述" };
      }
      if (voiceDesc.length > MAX_DESC_LENGTH) {
        return { error: `音色描述不能超过 ${MAX_DESC_LENGTH} 字` };
      }
      item.voiceDesc = voiceDesc;
    } else {
      const refIdx = Number.parseInt(seg?.refIdx, 10);
      if (!Number.isInteger(refIdx) || refIdx < 0) {
        return { error: "音色复刻段缺少参考音频标识" };
      }
      item.refIdx = refIdx;
    }
    segments.push(item);
  }
  return { segments };
}

// 并发池化合成，结果按下标保序；任一段失败即整体失败
async function synthesizeOrdered(segments, refFiles) {
  const results = new Array(segments.length);
  const models = { preset: TTS_MODEL, design: TTS_MODEL_DESIGN, clone: TTS_MODEL_CLONE };
  let refRate = 0;
  let nextIndex = 0;
  let failure = null;
  const worker = async () => {
    while (nextIndex < segments.length && !failure) {
      const index = nextIndex++;
      const seg = segments[index];
      let attempt = 0;
      for (;;) {
        try {
          const b64 = await synthesizeSegment({
            baseUrl: TTS_BASE_URL,
            allowedHosts: TTS_ALLOWED_HOSTS,
            apiKey: TTS_API_KEY,
            model: models[seg.mode] || TTS_MODEL,
            text: seg.text,
            voice: seg.voice,
            style: seg.style || undefined,
            mode: seg.mode,
            voiceDesc: seg.voiceDesc,
            refDataUrl: seg.mode === "clone" ? refFiles[seg.refIdx]?.dataUrl : undefined,
            timeoutMs: TTS_TIMEOUT_MS,
          });
          if (seg.mode === "preset") {
            results[index] = Buffer.from(b64, "base64");
          } else {
            const { pcm, sampleRate } = parseWavToPcm(Buffer.from(b64, "base64"));
            if (refRate && refRate !== sampleRate) {
              throw new UpstreamError(502, "各分段音频采样率不一致，无法拼接");
            }
            refRate = sampleRate;
            results[index] = pcm;
          }
          break;
        } catch (err) {
          // 上游限流/抖动退避重试一次（多角色会连续多次请求上游）
          const retryable = err instanceof UpstreamError && (err.status === 429 || err.status >= 500);
          if (retryable && attempt === 0) {
            attempt += 1;
            await new Promise((r) => setTimeout(r, 15000));
            continue;
          }
          failure = err;
          break;
        }
      }
    }
  };
  const workerCount = Math.min(SYNTH_CONCURRENCY, segments.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  if (failure) throw failure;
  const totalBytes = results.reduce((sum, b) => sum + b.length, 0);
  if (totalBytes === 0) {
    throw new UpstreamError(502, "音频数据为空");
  }
  return { buffers: results, sampleRate: refRate || PCM_SAMPLE_RATE };
}

router.post("/api/tts", refUpload.any(), async (req, res) => {
  if (!TTS_BASE_URL || !TTS_API_KEY) {
    return res.status(503).json({ error: "语音合成服务未配置，请联系管理员" });
  }
  const guard = validateOutboundUrl(TTS_BASE_URL);
  if (!guard.ok || !TTS_ALLOWED_HOSTS.includes(guard.host)) {
    return res.status(503).json({ error: "语音合成服务地址配置无效" });
  }

  // 简单 IP 限流（内存滑动窗口，1 分钟）
  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "unknown";
  const now = Date.now();
  const hits = (ttsRateMap.get(ip) || []).filter((t) => t > now - 60000);
  if (hits.length >= TTS_RATE_LIMIT) {
    return res.status(429).json({
      error: `请求太频繁，每分钟最多 ${TTS_RATE_LIMIT} 次，请稍后再试`,
    });
  }
  hits.push(now);
  ttsRateMap.set(ip, hits);

  // 复刻参考音频：按字段名 ref_<roleIndex> 映射（multipart 时由 multer 填充）
  const refFiles = {};
  for (const f of req.files || []) {
    if (f.fieldname.startsWith("ref_")) {
      const idx = Number(f.fieldname.slice(4));
      if (Number.isInteger(idx) && idx >= 0) {
        refFiles[idx] = {
          dataUrl: `data:${f.mimetype};base64,${f.buffer.toString("base64")}`,
          size: f.buffer.length,
        };
      }
    }
  }
  const parsed = parseSegments(req.body?.segments);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }
  for (const seg of parsed.segments) {
    if (seg.mode === "clone") {
      const ref = refFiles[seg.refIdx];
      if (!ref || ref.size === 0) {
        return res.status(400).json({ error: "音色复刻段缺少参考音频，请上传 mp3/wav（几秒即可）" });
      }
    }
  }

  try {
    const synth = await synthesizeOrdered(parsed.segments, refFiles);
    const { audio, durationSec } = pcmSegmentsToWav(synth.buffers, synth.sampleRate);
    res.json({ audio, durationSec, segments: parsed.segments.length });
  } catch (err) {
    console.error("[tts] synthesis failed:", err?.name, err?.code, err?.message);
    if (err instanceof UpstreamError) {
      return res.status(502).json({ error: err.message });
    }
    if (err?.code === "EGUARD") {
      return res.status(503).json({ error: "语音合成服务地址校验未通过，请检查配置" });
    }
    if (err?.name === "AbortError") {
      return res.status(504).json({ error: "合成超时，请重试或缩短文本" });
    }
    res.status(502).json({ error: "语音合成服务连接失败，请稍后再试" });
  }
});

// multer 错误（超限/格式不符）转 JSON 提示
router.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `参考音频不合规：${err.message}（要求 mp3/wav，≤10MB）` });
  }
  next(err);
});

export default router;

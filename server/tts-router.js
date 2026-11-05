import { Router } from "express";
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
const MAX_SEGMENTS = 30;
const MAX_SEGMENT_LENGTH = 500;
const PCM_SAMPLE_RATE = 24000;
const SYNTH_CONCURRENCY = 3;

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

// 44 字节标准 PCM WAV 头（24kHz 单声道 16bit）
function buildWavHeader(dataLength) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(PCM_SAMPLE_RATE, 24);
  header.writeUInt32LE(PCM_SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);
  return header;
}

function pcmSegmentsToWav(pcmBuffers) {
  const pcm = Buffer.concat(pcmBuffers);
  const durationSec = Math.round((pcm.length / 2 / PCM_SAMPLE_RATE) * 10) / 10;
  return {
    audio: Buffer.concat([buildWavHeader(pcm.length), pcm]).toString("base64"),
    durationSec,
  };
}

// 入参白名单校验：segments 数组，每段 { text, voice }
function parseSegments(rawSegments) {
  if (!Array.isArray(rawSegments) || rawSegments.length === 0) {
    return { error: "请提供待合成的文本分段" };
  }
  if (rawSegments.length > MAX_SEGMENTS) {
    return { error: `分段数不能超过 ${MAX_SEGMENTS} 段` };
  }
  const segments = [];
  for (const seg of rawSegments) {
    const text = typeof seg?.text === "string" ? seg.text.trim() : "";
    const voice =
      typeof seg?.voice === "string" && ALLOWED_VOICES.has(seg.voice)
        ? seg.voice
        : DEFAULT_VOICE;
    if (!text) {
      return { error: "存在空文本分段，请检查输入" };
    }
    if (text.length > MAX_SEGMENT_LENGTH) {
      return { error: `单段文本不能超过 ${MAX_SEGMENT_LENGTH} 字` };
    }
    segments.push({ text, voice });
  }
  return { segments };
}

// 并发池化合成，结果按下标保序；任一段失败即整体失败
async function synthesizeOrdered(segments) {
  const results = new Array(segments.length);
  let nextIndex = 0;
  let failure = null;
  const worker = async () => {
    while (nextIndex < segments.length && !failure) {
      const index = nextIndex++;
      try {
        const b64Pcm = await synthesizeSegment({
          baseUrl: TTS_BASE_URL,
          allowedHosts: TTS_ALLOWED_HOSTS,
          apiKey: TTS_API_KEY,
          model: TTS_MODEL,
          text: segments[index].text,
          voice: segments[index].voice,
          timeoutMs: TTS_TIMEOUT_MS,
        });
        results[index] = Buffer.from(b64Pcm, "base64");
      } catch (err) {
        failure = err;
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
  return results;
}

router.post("/api/tts", async (req, res) => {
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

  const parsed = parseSegments(req.body?.segments);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  try {
    const pcmBuffers = await synthesizeOrdered(parsed.segments);
    const { audio, durationSec } = pcmSegmentsToWav(pcmBuffers);
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

export default router;

import { guardPostJson } from "./url-guard.js";

/**
 * 小米 MiMo TTS（mimo-v2.5-tts）客户端。
 * 走 OpenAI 兼容 chat.completions：待合成文本必须放 assistant 消息，
 * audio.voice 指定音色，audio.format=pcm16（24kHz 单声道，便于多段拼接）。
 * 所有出站请求经 url-guard 的 guardPostJson 完成
 * 协议/主机白名单 -> 私网/保留地址 -> DNS 预解析 -> 禁止重定向。
 * 入参均已在路由层完成白名单校验，这里只负责组装与转发。
 */

export class UpstreamError extends Error {
  constructor(status, detail) {
    super(detail ? `语音合成服务返回错误（${status}）：${detail}` : `语音合成服务返回错误（${status}）`);
    this.status = status;
  }
}

export async function synthesizeSegment({ baseUrl, allowedHosts, apiKey, model, text, voice, style, timeoutMs }) {
  // 风格指令放 user 消息（仅控制语气，不会被合成进语音）；目标文本必须在 assistant 消息
  const messages = [];
  if (style) {
    messages.push({ role: "user", content: style });
  }
  messages.push({ role: "assistant", content: text });

  const upstream = await guardPostJson(`${baseUrl}/chat/completions`, {
    allowedHosts,
    timeoutMs: timeoutMs || 120000,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    payload: {
      model,
      messages,
      audio: { format: "pcm16", voice },
    },
  });

  if (!upstream.ok) {
    let detail = "";
    try {
      const err = JSON.parse(upstream.text);
      detail = err?.error?.message || "";
    } catch {
      // 上游错误体不是 JSON 时忽略
    }
    throw new UpstreamError(upstream.status, detail.slice(0, 300));
  }

  let data;
  try {
    data = JSON.parse(upstream.text);
  } catch {
    throw new UpstreamError(upstream.status, "响应不是有效 JSON");
  }

  const audio = data?.choices?.[0]?.message?.audio?.data;
  if (!audio) {
    throw new UpstreamError(upstream.status, "语音合成服务未返回音频数据");
  }
  return audio;
}

import { validateOutboundUrl, assertResolvablePublicHost } from "./url-guard.js";

/**
 * OpenAI 兼容 chat completions 客户端（中转站转发，支持 SSE 流式）。
 * 出站校验链与 url-guard.guardPostJson 一致：
 * 协议/主机白名单 -> 私网/保留地址 -> DNS 预解析 -> 禁止重定向。
 * 超时按「空闲时间」计：等待响应或流式期间每段数据之间超过 timeoutMs 即中止，
 * 避免长回答被固定总时长掐断。
 */

export class UpstreamError extends Error {
  constructor(status, detail) {
    super(detail ? `对话服务返回错误（${status}）：${detail}` : `对话服务返回错误（${status}）`);
    this.status = status;
  }
}

export async function streamChatCompletion({
  baseUrl,
  allowedHosts,
  apiKey,
  model,
  messages,
  maxTokens,
  timeoutMs = 120000,
  stream = true,
  signal,
  onDelta,
}) {
  const targetUrl = `${baseUrl}/chat/completions`;
  const guard = validateOutboundUrl(targetUrl);
  if (!guard.ok) {
    const e = new Error("出站地址校验未通过：" + guard.reason);
    e.code = "EGUARD";
    throw e;
  }
  const allowed = (allowedHosts || []).map((h) => String(h).trim().toLowerCase()).filter(Boolean);
  if (allowed.length === 0 || !allowed.includes(guard.host)) {
    const e = new Error("目标主机不在白名单内");
    e.code = "EGUARD";
    throw e;
  }
  await assertResolvablePublicHost(guard.host);

  const controller = new AbortController();
  const externalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", externalAbort, { once: true });
  }
  let idleTimer = setTimeout(() => controller.abort(), timeoutMs);
  const resetIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), timeoutMs);
  };

  const payload = { model, messages, stream };
  if (maxTokens) payload.max_tokens = maxTokens;

  try {
    const resp = await fetch(guard.url.href, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        Accept: stream ? "text/event-stream" : "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: "error",
    });
    if (!resp.ok) {
      const text = await resp.text();
      let detail = "";
      try {
        detail = JSON.parse(text)?.error?.message || "";
      } catch {
        // 上游错误体不是 JSON 时忽略
      }
      throw new UpstreamError(resp.status, detail.slice(0, 300));
    }

    if (!stream) {
      resetIdle();
      const text = await resp.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new UpstreamError(resp.status, "响应不是有效 JSON");
      }
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new UpstreamError(resp.status, "对话服务未返回内容");
      }
      if (onDelta) onDelta(content);
      return { content, model: data.model || model };
    }

    if (!resp.body) {
      throw new UpstreamError(resp.status, "上游未返回流式响应");
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    let upstreamModel = model;
    let finished = false;
    while (!finished) {
      const { value, done } = await reader.read();
      if (done) break;
      resetIdle();
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data) continue;
        if (data === "[DONE]") {
          finished = true;
          break;
        }
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          continue; // 跳过无法解析的分片
        }
        if (parsed && typeof parsed.model === "string") upstreamModel = parsed.model;
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) {
          content += delta;
          if (onDelta) onDelta(delta);
        }
      }
    }
    try {
      await reader.cancel();
    } catch {
      // 流已结束时忽略
    }
    if (content.length === 0) {
      throw new UpstreamError(resp.status, "对话服务未返回内容");
    }
    return { content, model: upstreamModel };
  } finally {
    clearTimeout(idleTimer);
    if (signal) signal.removeEventListener("abort", externalAbort);
  }
}

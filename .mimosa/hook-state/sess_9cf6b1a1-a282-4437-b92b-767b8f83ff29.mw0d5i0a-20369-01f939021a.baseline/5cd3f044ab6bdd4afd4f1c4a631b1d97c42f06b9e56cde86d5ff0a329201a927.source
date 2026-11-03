import { guardPostJson } from "./url-guard.js";

/**
 * OpenAI 兼容 images API 客户端（中转站转发）。
 * 所有出站请求都经由 url-guard 的 guardPostJson：
 * 协议/主机白名单 -> 私网/保留地址 -> DNS 预解析 -> 禁止重定向。
 * 入参均已在路由层完成白名单校验，这里只负责组装与转发。
 */

export class UpstreamError extends Error {
  constructor(status, detail) {
    super(detail ? `生图服务返回错误（${status}）：${detail}` : `生图服务返回错误（${status}）`);
    this.status = status;
  }
}

function buildRequestBody({ model, prompt, size, n, quality }) {
  const body = { model, prompt, n, size };
  if (quality) body.quality = quality;
  // gpt-image-1 固定返回 b64_json，不支持 response_format；dall-e 系列需显式指定
  if (model.startsWith("dall-e")) body.response_format = "b64_json";
  return body;
}

export async function generateImages({ baseUrl, allowedHosts, apiKey, model, prompt, size, n, quality, timeoutMs }) {
  const upstream = await guardPostJson(`${baseUrl}/images/generations`, {
    allowedHosts,
    timeoutMs: timeoutMs || 300000,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    payload: buildRequestBody({ model, prompt, size, n, quality }),
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

  const images = (Array.isArray(data.data) ? data.data : []).map((d) => d?.b64_json).filter(Boolean);
  if (images.length === 0) {
    throw new UpstreamError(upstream.status, "生图服务未返回图片数据");
  }
  return { images, model: data.model || model };
}

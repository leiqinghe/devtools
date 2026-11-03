import { validateOutboundUrl, assertResolvablePublicHost } from "./url-guard.js";

/**
 * OpenAI 兼容 images/edits 客户端（图生图，multipart 转发）。
 * 出站校验链与 guardPostJson 一致：协议/主机白名单 -> 私网/保留地址 -> DNS 预解析 -> 禁止重定向。
 * 差异仅在于 body 为 FormData（fetch 自动按 multipart/form-data 编码）。
 */

export class UpstreamError extends Error {
  constructor(status, detail) {
    super(detail ? `生图服务返回错误（${status}）：${detail}` : `生图服务返回错误（${status}）`);
    this.status = status;
  }
}

export async function editImages({ baseUrl, allowedHosts, apiKey, model, prompt, images, size, n, timeoutMs }) {
  const guard = validateOutboundUrl(baseUrl);
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

  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  if (size && size !== "auto") form.append("size", size);
  form.append("n", String(n));
  images.forEach((buf, i) => {
    const name = i === 0 ? "image" : `image-${i}`;
    form.append(i === 0 ? "image" : "image[]", new Blob([buf], { type: "image/png" }), `${name}.png`);
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 300000);
  try {
    const resp = await fetch(`${baseUrl}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
      redirect: "error",
    });
    const text = await resp.text();
    if (!resp.ok) {
      let detail = "";
      try {
        const err = JSON.parse(text);
        detail = err?.error?.message || "";
      } catch {
        // 上游错误体不是 JSON 时忽略
      }
      throw new UpstreamError(resp.status, detail.slice(0, 300));
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new UpstreamError(resp.status, "响应不是有效 JSON");
    }
    const out = (Array.isArray(data.data) ? data.data : []).map((d) => d?.b64_json).filter(Boolean);
    if (out.length === 0) {
      throw new UpstreamError(resp.status, "生图服务未返回图片数据");
    }
    return { images: out, model: data.model || model };
  } finally {
    clearTimeout(timer);
  }
}

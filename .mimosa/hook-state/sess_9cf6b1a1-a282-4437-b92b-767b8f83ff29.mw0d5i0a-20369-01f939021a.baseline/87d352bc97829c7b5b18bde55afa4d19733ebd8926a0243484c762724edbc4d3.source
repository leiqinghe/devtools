import net from "node:net";
import dns from "node:dns";
import { promisify } from "node:util";

const lookup = promisify(dns.lookup);

/**
 * 出站 URL 防护（用于中转站转发）：
 * - 协议仅允许 http/https
 * - 拒绝 localhost、环回、私有、链路本地及保留地址（IPv4 数值校验 + IPv6 前缀）
 * - 发请求前 DNS 预解析，解析结果落在保留地址段则拒绝
 */

// IPv4 保留段（CIDR -> 上下界数值区间），数值比较避免正则遗漏
const BLOCKED_V4_RANGES = [
  ["0.0.0.0/8", "0.0.0.0", "0.255.255.255"], // 本机网络
  ["10.0.0.0/8", "10.0.0.0", "10.255.255.255"], // 私有
  ["100.64.0.0/10", "100.64.0.0", "100.127.255.255"], // CGNAT
  ["127.0.0.0/8", "127.0.0.0", "127.255.255.255"], // 环回
  ["169.254.0.0/16", "169.254.0.0", "169.254.255.255"], // 链路本地（含云元数据 169.254.169.254）
  ["172.16.0.0/12", "172.16.0.0", "172.31.255.255"], // 私有
  ["192.0.0.0/24", "192.0.0.0", "192.0.0.255"], // 保留
  ["192.0.2.0/24", "192.0.2.0", "192.0.2.255"], // TEST-NET-1
  ["192.88.99.0/24", "192.88.99.0", "192.88.99.255"], // 保留
  ["192.168.0.0/16", "192.168.0.0", "192.168.255.255"], // 私有
  ["198.18.0.0/15", "198.18.0.0", "198.19.255.255"], // 基准测试
  ["198.51.100.0/24", "198.51.100.0", "198.51.100.255"], // TEST-NET-2
  ["203.0.113.0/24", "203.0.113.0", "203.0.113.255"], // TEST-NET-3
  ["224.0.0.0/4", "224.0.0.0", "239.255.255.255"], // 组播
  ["240.0.0.0/4", "240.0.0.0", "255.255.255.255"], // 保留
].map(([, lo, hi]) => [ipv4ToNumber(lo), ipv4ToNumber(hi)]);

function ipv4ToNumber(ip) {
  const o = ip.split(".").map(Number);
  return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
}

function isBlockedIp(ip) {
  const v = net.isIP(ip);
  if (v === 4) {
    const n = ipv4ToNumber(ip);
    return BLOCKED_V4_RANGES.some(([lo, hi]) => n >= lo && n <= hi);
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true; // 未指定 / 环回
    if (lower.startsWith("::ffff:")) return isBlockedIp(lower.slice(7)); // IPv4-mapped
    // fc00::/7 私有、fe80::/10 链路本地、ff00::/8 组播
    return /^[fd][89ab-f]/.test(lower) || /^f[ef]/.test(lower) || /^ff/.test(lower);
  }
  return true; // 非法地址一律拒绝
}

export function validateOutboundUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "URL 解析失败" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "仅允许 http/https 协议" };
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return { ok: false, reason: "禁止访问本机/内网域名" };
  }
  if (net.isIP(host) && isBlockedIp(host)) {
    return { ok: false, reason: "禁止访问内网/保留地址" };
  }
  return { ok: true, url, host };
}

// 发请求前 DNS 预解析：域名解析到保留地址则拒绝（缓解 DNS rebinding）
export async function assertResolvablePublicHost(host) {
  if (net.isIP(host)) return; // 已是 IP，validateOutboundUrl 已校验
  const result = await lookup(host, { all: true, verbatim: true });
  if (!result || result.length === 0) {
    throw new Error("生图服务域名无法解析");
  }
  for (const { address } of result) {
    if (isBlockedIp(address)) {
      throw new Error("生图服务域名解析到内网/保留地址");
    }
  }
}

// 每次出站请求前执行完整校验链：协议/主机白名单 -> 私网/保留地址 -> DNS 预解析 -> 禁止重定向。
// 只有全部通过后才发起请求；仅用于转发到管理员配置的中转站地址。
export async function guardPostJson(targetUrl, { allowedHosts, timeoutMs = 120000, headers, payload }) {
  const guard = validateOutboundUrl(targetUrl);
  if (!guard.ok) {
    const e = new Error("出站地址校验未通过：" + guard.reason);
    e.code = "EGUARD";
    throw e;
  }
  // 显式主机白名单（allowlist）
  const allowed = (allowedHosts || []).map((h) => String(h).trim().toLowerCase()).filter(Boolean);
  if (allowed.length === 0 || !allowed.includes(guard.host)) {
    const e = new Error("目标主机不在白名单内");
    e.code = "EGUARD";
    throw e;
  }
  await assertResolvablePublicHost(guard.host);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(guard.url.href, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: "error", // 禁止跟随重定向
    });
    const text = await resp.text();
    return { status: resp.status, ok: resp.ok, text };
  } finally {
    clearTimeout(timer);
  }
}

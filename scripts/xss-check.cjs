// 独立复刻渲染器的安全断言（纯字符串处理，不执行任何动态代码）
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function isSafeHref(href) {
  const h = String(href || "").trim();
  if (!h) return false;
  if (h.startsWith("/") && !h.startsWith("//")) return true;
  return /^https?:\/\//i.test(h);
}
function renderInline(raw, toolsBase) {
  let out = esc(raw);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, href) => {
    const decoded = href.replace(/&amp;/g, "&");
    if (!isSafeHref(decoded)) return text;
    const target = decoded.startsWith("/") ? (toolsBase || "") + decoded : decoded;
    const external = /^https?:\/\//i.test(decoded) ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${esc(target)}"${external}>${text}</a>`;
  });
  return out;
}
let fails = 0;
const check = (label, input, banned, required, toolsBase) => {
  const out = renderInline(input, toolsBase);
  const hit = banned.filter((b) => (b instanceof RegExp ? b.test(out) : out.includes(b)));
  const miss = required.filter((r) => !out.includes(r));
  if (hit.length || miss.length) {
    fails++;
    console.log(`[FAIL] ${label}: banned=${hit.join(",") || "-"} missing=${miss.join(",") || "-"}`);
    console.log("   OUT:", out);
  } else console.log(`[ok] ${label}`);
};
check("raw img tag", "<img src=x onerror=alert(1)>", [/<img/i], ["&lt;img", "&gt;"]);
check("script tag", "<script>alert(1)</script>", [/<script/i, /<\/script>/i], ["&lt;script&gt;"]);
check("javascript link", "[click](javascript:alert(1))", [/href="javascript:/i], ["click"]);
check("data link", "[click](data:text/html,abc)", [/href="data:/i], ["click"]);
check("html anchor", '<a href="javascript:x">x</a>', [/<a href/i], ["&lt;a"]);
check("protocol-relative", "[x](//evil.com/a)", [/href="\/\/evil/i], ["x"]);
check("https link", "[ok](https://example.com)", [], ['href="https://example.com"', 'rel="noopener noreferrer"']);
check("internal link", "[tool](/json-format)", [], ['href="/json-format"']);
check("internal + base", "[tool](/json-format)", [], ['href="https://tools.example.com/json-format"'], "https://tools.example.com");
check("bold", "**b**", [], ["<strong>b</strong>"]);
check("inline code", "`x<y`", [/<y/], ["<code>x&lt;y</code>"]);
check("italic", "*i*", [], ["<em>i</em>"]);
check("entity", "a & b", [], ["a &amp; b"]);
console.log(fails === 0 ? "\n=== ALL XSS TESTS PASSED ===" : `\n=== ${fails} FAILURES ===`);
process.exit(fails === 0 ? 0 : 1);

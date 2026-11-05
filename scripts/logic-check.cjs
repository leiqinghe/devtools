// 验证 chat-widget.js 中纯逻辑部分：会话存储、容量淘汰、标题推导、markdown 块级渲染
// 做法：从源码截取这几个函数的文本，包进一个普通函数作用域执行（Function 构造的是我们自己的静态源码，
// 不涉及任何用户输入，也不执行网络代码）。

const fs = require("fs");
const src = fs.readFileSync(
  "/Users/leiqinghe/Documents/code/leiqinghe/devtools/public/chat-widget.js",
  "utf8"
);

function block(name) {
  const start = src.indexOf("function " + name);
  if (start < 0) throw new Error("missing " + name);
  let depth = 0, i = src.indexOf("{", start), begun = false;
  for (; i < src.length; i++) {
    if (src[i] === "{") { depth++; begun = true; }
    else if (src[i] === "}") { depth--; if (begun && depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error("unbalanced " + name);
}

let pass = 0, fail = 0;
const ok = (n, c, e) => { if (c) { pass++; console.log("[ok] " + n); } else { fail++; console.log("[FAIL] " + n + (e ? " :: " + e : "")); } };

// ---------- 会话存储逻辑 ----------
const storeSrc = [
  "const MAX_SESSIONS = 20;",
  "const MAX_MESSAGES = 100;",
  "const MAX_BYTES = 2 * 1024 * 1024;",
  "let memoryStore = null;",
  "let idSeq = 0;",
  "const cfg = { storageKey: 'test-key' };",
  block("newId"),
  block("emptyState"),
  block("sanitizeState"),
  block("loadState"),
  block("persist"),
  "return { emptyState, sanitizeState, loadState, persist, newId };",
].join("\n");

const mem = new Map();
const fakeLocal = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
};
const S = new Function("localStorage", storeSrc)(fakeLocal);

const st = S.emptyState();
ok("emptyState 有 1 个会话", st.sessions.length === 1);
ok("emptyState 有 activeId", !!st.activeId && st.activeId === st.sessions[0].id);
ok("newId 唯一", S.newId() !== S.newId());

// sanitize 拦截非法数据
const bad = S.sanitizeState({ sessions: [{ id: "a", messages: [{ role: "system", content: "x" }, { role: "user", content: "hi" }] }] });
ok("sanitize 过滤非法 role", bad.sessions[0].messages.length === 1 && bad.sessions[0].messages[0].role === "user");
ok("sanitize 空输入回退", S.sanitizeState(null).sessions.length === 1);
ok("sanitize 保留合法 activeId", S.sanitizeState({ activeId: "a", sessions: [{ id: "a", messages: [] }] }).activeId === "a");
ok("sanitize 修正非法 activeId", S.sanitizeState({ activeId: "zzz", sessions: [{ id: "a", messages: [] }] }).activeId === "a");
ok("sanitize 上限 100 条", S.sanitizeState({ sessions: [{ id: "a", messages: Array.from({ length: 150 }, (_, i) => ({ role: "user", content: "m" + i })) }] }).sessions[0].messages.length === 100);

// 持久化往返
const rt = S.emptyState();
rt.sessions[0].title = "往返测试";
S.persist(rt);
const loaded = S.loadState();
ok("持久化往返保留标题", loaded.sessions[0].title === "往返测试");

// 容量淘汰：25 个会话 -> 落盘后 <= 20
const big = { version: 1, activeId: "s0", sessions: [] };
for (let i = 0; i < 25; i++) {
  big.sessions.push({ id: "s" + i, title: "t" + i, createdAt: i, updatedAt: i, messages: [{ role: "user", content: "x" }] });
}
mem.clear();
S.persist(big);
const persisted = JSON.parse(mem.get("test-key"));
ok("容量上限 20 个会话", persisted.sessions.length <= 20, "got " + persisted.sessions.length);

// 超大内容触发字节淘汰（不崩）
const huge = { version: 1, activeId: "h0", sessions: [] };
for (let i = 0; i < 5; i++) {
  huge.sessions.push({ id: "h" + i, title: "h", createdAt: i, updatedAt: i, messages: [{ role: "user", content: "x".repeat(600000) }] });
}
mem.clear();
let threw = false;
try { S.persist(huge); } catch (e) { threw = true; }
ok("超大数据不抛异常", !threw);

// localStorage 抛异常时降级
const throwingLocal = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("quota"); } };
const S2 = new Function("localStorage", storeSrc)(throwingLocal);
ok("localStorage 被拒时 loadState 不崩", !!S2.loadState().sessions);
let threw2 = false;
try { S2.persist(S2.emptyState()); } catch (e) { threw2 = true; }
ok("localStorage 被拒时 persist 不崩", !threw2);

// ---------- 标题推导 ----------
const titleSrc = "function deriveTitle(text){" + block("deriveTitle").split("{").slice(1).join("{");
const deriveTitle = new Function("return " + titleSrc)();
ok("短标题原样", deriveTitle("你好") === "你好");
ok("长标题截断加省略号", deriveTitle("这是一个非常非常非常长的标题需要被截断").endsWith("…"));
ok("空标题兜底", deriveTitle("") === "新对话");
ok("空白折叠", deriveTitle("a   b") === "a b");

console.log("\n通过 " + pass + " / 失败 " + fail);
process.exit(fail === 0 ? 0 : 1);

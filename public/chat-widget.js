(function () {
  "use strict";
  if (window.__cwLoaded) return;
  window.__cwLoaded = true;

  const script =
    document.currentScript ||
    document.querySelector('script[src*="chat-widget"]');
  const attr = (name) => (script ? script.getAttribute(name) : null);
  const parseModels = (raw) =>
    (raw || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const i = s.indexOf(":");
        return i > 0 ? { id: s.slice(0, i), label: s.slice(i + 1) } : { id: s, label: s };
      });
  const cfg = {
    api: attr("data-api") || "/api/chat",
    tts: attr("data-tts") || "/api/tts",
    avatar: attr("data-avatar") || "",
    title: attr("data-title") || "小雷助手",
    welcome: attr("data-welcome") || "你好，我是小雷助手，有什么可以帮你的吗？",
    models: parseModels(attr("data-models")),
    toolsBase: attr("data-tools-base") || "",
    voice: attr("data-voice") || "茉莉",
    storageKey: "devtools-chat-sessions",
  };
  let selectedModel = cfg.models.length > 0 ? cfg.models[0].id : "";

  // ---------------------------------------------------------------- markdown
  // 安全模型：所有文本先经 esc() 转义，再对转义后的文本做受限替换。
  // 因此即使模型输出 <img onerror=...> 也只会变成可见文本，不会生成 DOM。
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

  // 行内：`code`、**bold**、*italic*、[text](href)
  function renderInline(raw) {
    let out = esc(raw);
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, href) => {
      const decoded = href.replace(/&amp;/g, "&");
      if (!isSafeHref(decoded)) return text;
      const target = decoded.startsWith("/") ? cfg.toolsBase + decoded : decoded;
      const external = /^https?:\/\//i.test(decoded) ? ' target="_blank" rel="noopener noreferrer"' : "";
      return `<a href="${esc(target)}"${external}>${text}</a>`;
    });
    return out;
  }
  // 块级：围栏代码块 / 标题 / 分隔线 / 引用 / 列表 / 表格 / 段落
  function renderMarkdown(raw) {
    const text = String(raw == null ? "" : raw).replace(/\r\n/g, "\n");
    const lines = text.split("\n");
    const html = [];
    let i = 0;
    let listStack = null; // { tag: "ul"|"ol" }
    let para = [];

    const closeList = () => {
      if (listStack) {
        html.push(`</${listStack.tag}>`);
        listStack = null;
      }
    };
    const flushPara = () => {
      if (para.length > 0) {
        html.push(`<p>${renderInline(para.join("\n")).replace(/\n/g, "<br>")}</p>`);
        para = [];
      }
    };

    while (i < lines.length) {
      const line = lines[i];

      // 围栏代码块
      const fence = line.match(/^\s*```\s*([\w+#.-]*)\s*$/);
      if (fence) {
        flushPara();
        closeList();
        const lang = fence[1] || "";
        const body = [];
        i += 1;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
          body.push(lines[i]);
          i += 1;
        }
        i += 1; // 跳过结束围栏
        const cls = lang ? ` class="language-${esc(lang)}"` : "";
        html.push(
          `<div class="cw-code"><div class="cw-code-bar"><span>${esc(lang || "code")}</span>` +
            `<button type="button" class="cw-copy-code">复制</button></div>` +
            `<pre><code${cls}>${esc(body.join("\n"))}</code></pre></div>`
        );
        continue;
      }

      // 标题
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        flushPara();
        closeList();
        const lv = h[1].length;
        html.push(`<h${lv}>${renderInline(h[2])}</h${lv}>`);
        i += 1;
        continue;
      }

      // 分隔线
      if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
        flushPara();
        closeList();
        html.push("<hr>");
        i += 1;
        continue;
      }

      // 引用
      const quote = line.match(/^\s*>\s?(.*)$/);
      if (quote) {
        flushPara();
        closeList();
        const buf = [quote[1]];
        i += 1;
        while (i < lines.length && /^\s*>/.test(lines[i])) {
          buf.push(lines[i].replace(/^\s*>\s?/, ""));
          i += 1;
        }
        html.push(`<blockquote>${renderInline(buf.join("\n")).replace(/\n/g, "<br>")}</blockquote>`);
        continue;
      }

      // 表格（表头 + 分隔行）
      if (/\|/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:-]+\|[\s:|-]*$/.test(lines[i + 1])) {
        flushPara();
        closeList();
        const splitRow = (r) =>
          r.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
        const heads = splitRow(line);
        i += 2;
        const rows = [];
        while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim() !== "") {
          rows.push(splitRow(lines[i]));
          i += 1;
        }
        let t = "<div class=\"cw-table-wrap\"><table><thead><tr>";
        heads.forEach((c) => (t += `<th>${renderInline(c)}</th>`));
        t += "</tr></thead><tbody>";
        rows.forEach((r) => {
          t += "<tr>";
          heads.forEach((_, ci) => (t += `<td>${renderInline(r[ci] || "")}</td>`));
          t += "</tr>";
        });
        t += "</tbody></table></div>";
        html.push(t);
        continue;
      }

      // 列表
      const li = line.match(/^\s*([-*+]|\d+\.)\s+(.*)$/);
      if (li) {
        flushPara();
        const wantTag = /^\d+\.$/.test(li[1]) ? "ol" : "ul";
        if (!listStack || listStack.tag !== wantTag) {
          closeList();
          html.push(`<${wantTag}>`);
          listStack = { tag: wantTag };
        }
        html.push(`<li>${renderInline(li[2])}</li>`);
        i += 1;
        continue;
      }

      // 空行
      if (line.trim() === "") {
        flushPara();
        closeList();
        i += 1;
        continue;
      }

      para.push(line);
      i += 1;
    }
    flushPara();
    closeList();
    return html.join("");
  }
  // ------------------------------------------------------------- 会话存储层
  const MAX_SESSIONS = 20;
  const MAX_MESSAGES = 100;
  const MAX_BYTES = 2 * 1024 * 1024;
  let memoryStore = null; // localStorage 不可用时降级到此

  let idSeq = 0;
  function newId() {
    // 仅用于当前浏览器内的会话标识，不参与任何鉴权或加密。
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return "s" + window.crypto.randomUUID();
      }
    } catch (e) {
      // 老浏览器降级
    }
    idSeq += 1;
    return "s" + Date.now().toString(36) + "-" + idSeq.toString(36);
  }

  function emptyState() {
    const now = Date.now();
    const s = { id: newId(), title: "新对话", createdAt: now, updatedAt: now, messages: [] };
    return { version: 1, activeId: s.id, sessions: [s] };
  }

  function sanitizeState(raw) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.sessions) || raw.sessions.length === 0) {
      return emptyState();
    }
    const sessions = [];
    for (const s of raw.sessions) {
      if (!s || typeof s.id !== "string") continue;
      const messages = Array.isArray(s.messages)
        ? s.messages
            .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
            .slice(-MAX_MESSAGES)
            .map((m) => ({ role: m.role, content: m.content, ts: Number(m.ts) || Date.now() }))
        : [];
      sessions.push({
        id: s.id,
        title: typeof s.title === "string" && s.title ? s.title.slice(0, 40) : "新对话",
        createdAt: Number(s.createdAt) || Date.now(),
        updatedAt: Number(s.updatedAt) || Date.now(),
        messages,
      });
      if (sessions.length >= MAX_SESSIONS) break;
    }
    if (sessions.length === 0) return emptyState();
    const activeId = sessions.some((s) => s.id === raw.activeId) ? raw.activeId : sessions[0].id;
    return { version: 1, activeId, sessions };
  }

  function loadState() {
    if (memoryStore) return sanitizeState(memoryStore);
    try {
      const txt = localStorage.getItem(cfg.storageKey);
      return sanitizeState(txt ? JSON.parse(txt) : null);
    } catch (e) {
      return emptyState();
    }
  }

  function persist(state) {
    // 容量保护：超限时淘汰最旧会话
    let list = state.sessions.slice(0, MAX_SESSIONS);
    let payload = JSON.stringify({ version: 1, activeId: state.activeId, sessions: list });
    while (payload.length > MAX_BYTES && list.length > 1) {
      const oldest = list.reduce((a, b) => (a.updatedAt <= b.updatedAt ? a : b));
      list = list.filter((s) => s.id !== oldest.id);
      const activeId = list.some((s) => s.id === state.activeId) ? state.activeId : list[0].id;
      payload = JSON.stringify({ version: 1, activeId, sessions: list });
    }
    try {
      localStorage.setItem(cfg.storageKey, payload);
      memoryStore = null;
    } catch (e) {
      // 隐私模式 / 配额满：降级为内存会话，不打扰用户
      memoryStore = { version: 1, activeId: state.activeId, sessions: list };
    }
  }
  // ---------------------------------------------------------------- 样式
  const css = [];
  css.push(`
    :host { all: initial; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .cw-root { position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif; }
    .cw-fab { width: 56px; height: 56px; border-radius: 50%; border: none; padding: 0; cursor: pointer;
      overflow: hidden; display: block; background: linear-gradient(135deg, #6366f1, #a855f7);
      box-shadow: 0 6px 24px rgba(60,60,120,.28); transition: transform .2s ease, box-shadow .2s ease;
      animation: cw-pop .5s cubic-bezier(.34,1.56,.64,1); position: relative; }
    .cw-fab:hover { transform: scale(1.08); box-shadow: 0 8px 28px rgba(60,60,120,.36); }
    .cw-fab:active { transform: scale(.96); }
    .cw-fab img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .cw-fab-emoji { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
      font-size: 28px; color: #fff; }
    .cw-badge { position: absolute; top: -2px; right: -2px; width: 12px; height: 12px; border-radius: 50%;
      background: #22c55e; border: 2px solid #fff; }
    @keyframes cw-pop { 0% { opacity: 0; transform: scale(.4) translateY(16px); } 100% { opacity: 1; transform: none; } }
  `);
  css.push(`
    .cw-panel { position: fixed; right: 20px; bottom: 92px; width: min(400px, calc(100vw - 24px));
      height: min(620px, calc(100vh - 130px)); background: #fff; border-radius: 16px;
      border: 1px solid rgba(99,102,241,.12); box-shadow: 0 16px 56px rgba(20,20,50,.24);
      display: flex; flex-direction: column; overflow: hidden; opacity: 0;
      transform: translateY(14px) scale(.97); pointer-events: none;
      transition: opacity .22s ease, transform .22s ease; }
    .cw-panel.cw-open { opacity: 1; transform: none; pointer-events: auto; }
    .cw-head { display: flex; align-items: center; gap: 9px; padding: 11px 12px; flex: none;
      background: linear-gradient(135deg, #eef2ff, #f5f0ff); border-bottom: 1px solid #ececf2; }
    .cw-head-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex: none; }
    .cw-head-main { flex: 1; min-width: 0; }
    .cw-head-title { font-size: 14px; font-weight: 600; color: #1c1c26; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis; }
    .cw-head-sub { font-size: 11.5px; color: #8a8a96; margin-top: 1px; }
    .cw-icon-btn { border: none; background: transparent; font-size: 15px; line-height: 1; color: #6b6b78;
      cursor: pointer; padding: 6px 7px; border-radius: 8px; flex: none; font-family: inherit; }
    .cw-icon-btn:hover { background: rgba(0,0,0,.06); color: #1c1c26; }
  `);
  css.push(`
    .cw-msgs { flex: 1; overflow-y: auto; padding: 14px 13px; display: flex; flex-direction: column;
      gap: 12px; background: #f7f7fb; scroll-behavior: smooth; }
    .cw-row { display: flex; flex-direction: column; gap: 5px; }
    .cw-user { align-items: flex-end; }
    .cw-bot { align-items: flex-start; }
    .cw-bubble { max-width: 92%; padding: 9px 12px; border-radius: 13px; font-size: 13.5px;
      line-height: 1.68; word-break: break-word; overflow-x: auto; }
    .cw-bot .cw-bubble { background: #fff; border: 1px solid #e8e8f0; color: #23232e;
      border-top-left-radius: 4px; width: fit-content; }
    .cw-user .cw-bubble { background: linear-gradient(135deg, #6366f1, #7c5cf6); color: #fff;
      border-top-right-radius: 4px; white-space: pre-wrap; }
    .cw-error .cw-bubble { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }
    .cw-bubble p { margin: 0 0 7px; }
    .cw-bubble p:last-child { margin-bottom: 0; }
    .cw-bubble h1, .cw-bubble h2, .cw-bubble h3, .cw-bubble h4 {
      font-size: 14.5px; font-weight: 650; margin: 10px 0 6px; color: #16161f; line-height: 1.45; }
    .cw-bubble h1:first-child, .cw-bubble h2:first-child, .cw-bubble h3:first-child { margin-top: 0; }
    .cw-bubble ul, .cw-bubble ol { margin: 4px 0 8px; padding-left: 20px; }
    .cw-bubble li { margin: 2px 0; }
    .cw-bubble blockquote { border-left: 3px solid #c7d2fe; background: #f5f6ff; margin: 6px 0;
      padding: 6px 10px; color: #4a4a5c; border-radius: 0 6px 6px 0; }
    .cw-bubble hr { border: none; border-top: 1px solid #e8e8f0; margin: 10px 0; }
    .cw-bubble code { background: #f1f1f7; color: #b4295f; padding: 1px 4px; border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; }
    .cw-bubble a { color: #4f46e5; text-decoration: underline; text-underline-offset: 2px; }
    .cw-bubble strong { font-weight: 650; color: #101018; }
    .cw-table-wrap { overflow-x: auto; margin: 8px 0; }
    .cw-bubble table { border-collapse: collapse; font-size: 12.5px; width: 100%; }
    .cw-bubble th, .cw-bubble td { border: 1px solid #e4e4ee; padding: 5px 8px; text-align: left; }
    .cw-bubble th { background: #f4f4fa; font-weight: 600; }
  `);
  css.push(`
    .cw-code { background: #1e1e2a; border-radius: 9px; overflow: hidden; margin: 8px 0; }
    .cw-code-bar { display: flex; align-items: center; justify-content: space-between;
      padding: 5px 10px; background: #2a2a3a; color: #9a9ab0; font-size: 11px;
      font-family: ui-monospace, Menlo, Consolas, monospace; }
    .cw-copy-code { border: none; background: transparent; color: #a5b4fc; font-size: 11px;
      cursor: pointer; padding: 2px 6px; border-radius: 4px; font-family: inherit; }
    .cw-copy-code:hover { background: rgba(255,255,255,.1); color: #c7d2fe; }
    .cw-code pre { margin: 0; padding: 10px 11px; overflow-x: auto; }
    .cw-code code { background: none; color: #e4e4f0; padding: 0; font-size: 12.5px; line-height: 1.6;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .cw-tool-card { display: flex; align-items: center; gap: 10px; margin: 7px 0;
      padding: 9px 11px; border: 1px solid #dbe0ff; border-radius: 10px; background: #f7f8ff;
      text-decoration: none; transition: border-color .15s ease, background .15s ease, transform .15s ease; }
    .cw-tool-card:hover { border-color: #6366f1; background: #eef2ff; transform: translateY(-1px); }
    .cw-tool-dot { width: 30px; height: 30px; border-radius: 9px; flex: none;
      background: linear-gradient(135deg, #6366f1, #a855f7); color: #fff; font-size: 13px;
      display: flex; align-items: center; justify-content: center; font-weight: 600; }
    .cw-tool-body { flex: 1; min-width: 0; }
    .cw-tool-title { font-size: 13px; font-weight: 600; color: #2a2a3c; }
    .cw-tool-desc { font-size: 11.5px; color: #7c7c90; margin-top: 1px; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis; }
    .cw-tool-arrow { color: #a5a5b8; font-size: 13px; flex: none; }
  `);
  css.push(`
    .cw-actions { display: flex; gap: 2px; opacity: 0; transition: opacity .15s ease; }
    .cw-row:hover .cw-actions, .cw-actions.cw-always { opacity: 1; }
    .cw-act { border: none; background: transparent; color: #8a8a9c; font-size: 11.5px;
      cursor: pointer; padding: 3px 7px; border-radius: 6px; font-family: inherit;
      display: inline-flex; align-items: center; gap: 3px; }
    .cw-act:hover { background: rgba(99,102,241,.1); color: #4f46e5; }
    .cw-act.cw-on { color: #4f46e5; background: rgba(99,102,241,.12); }
    .cw-act:disabled { opacity: .4; cursor: default; }
    .cw-quick { display: flex; flex-direction: column; gap: 7px; margin-top: 4px; }
    .cw-quick-title { font-size: 11.5px; color: #9a9ab0; padding-left: 2px; }
    .cw-quick-item { text-align: left; border: 1px solid #e4e4ee; background: #fff; color: #40404f;
      font-size: 12.5px; padding: 8px 11px; border-radius: 9px; cursor: pointer; font-family: inherit;
      transition: border-color .15s ease, background .15s ease; }
    .cw-quick-item:hover { border-color: #a5b4fc; background: #f7f8ff; color: #4338ca; }
  `);
  css.push(`
    .cw-drawer { position: absolute; inset: 0; background: rgba(20,20,40,.28); display: none;
      align-items: stretch; z-index: 5; }
    .cw-drawer.cw-show { display: flex; }
    .cw-drawer-panel { width: 74%; max-width: 280px; background: #fff; display: flex;
      flex-direction: column; box-shadow: 4px 0 24px rgba(0,0,0,.12); }
    .cw-drawer-head { display: flex; align-items: center; justify-content: space-between;
      padding: 11px 12px; border-bottom: 1px solid #ececf2; flex: none; }
    .cw-drawer-title { font-size: 13px; font-weight: 600; color: #1c1c26; }
    .cw-new-chat { margin: 10px 12px; padding: 8px; border: 1px dashed #c7d2fe; background: #f7f8ff;
      color: #4f46e5; border-radius: 8px; font-size: 12.5px; cursor: pointer; font-family: inherit; flex: none; }
    .cw-new-chat:hover { background: #eef2ff; border-color: #6366f1; }
    .cw-sess-list { flex: 1; overflow-y: auto; padding: 0 8px 10px; }
    .cw-sess { display: flex; align-items: center; gap: 6px; padding: 8px 9px; border-radius: 8px;
      cursor: pointer; margin-bottom: 2px; }
    .cw-sess:hover { background: #f4f4fa; }
    .cw-sess.cw-active { background: #eef2ff; }
    .cw-sess-name { flex: 1; min-width: 0; font-size: 12.5px; color: #33334a; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis; }
    .cw-sess.cw-active .cw-sess-name { color: #4338ca; font-weight: 600; }
    .cw-sess-del { border: none; background: transparent; color: #b0b0c0; font-size: 12px;
      cursor: pointer; padding: 2px 4px; border-radius: 4px; flex: none; font-family: inherit; }
    .cw-sess-del:hover { background: #fee2e2; color: #dc2626; }
  `);
  css.push(`
    .cw-models { flex: none; display: flex; gap: 6px; padding: 7px 12px 0; background: #fff; }
    .cw-model-chip { border: 1px solid #e2e2ec; background: #fafafc; color: #5a5a68; font-size: 11.5px;
      padding: 3px 10px; border-radius: 999px; cursor: pointer; font-family: inherit;
      transition: border-color .15s ease, color .15s ease, background .15s ease; }
    .cw-model-chip:hover { border-color: #6366f1; color: #6366f1; }
    .cw-model-chip.cw-active { background: #eef2ff; border-color: #6366f1; color: #6366f1; font-weight: 600; }
    .cw-input-row { flex: none; display: flex; align-items: flex-end; gap: 8px; padding: 9px 12px;
      background: #fff; border-top: 1px solid #ececf2; }
    .cw-input { flex: 1; resize: none; border: 1px solid #e2e2ec; border-radius: 10px; padding: 8px 10px;
      font-size: 13.5px; line-height: 1.5; max-height: 104px; outline: none; background: #fafafc;
      color: #23232e; font-family: inherit; transition: border-color .15s ease, box-shadow .15s ease; }
    .cw-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.15); background: #fff; }
    .cw-input:disabled { opacity: .6; }
    .cw-send { flex: none; width: 36px; height: 36px; border-radius: 10px; border: none; color: #fff;
      background: linear-gradient(135deg, #6366f1, #7c5cf6); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: opacity .15s ease, transform .15s ease; }
    .cw-send:hover { transform: translateY(-1px); }
    .cw-send:disabled { opacity: .45; cursor: default; transform: none; }
    .cw-foot { flex: none; text-align: center; font-size: 10.5px; color: #a2a2ae; padding: 4px 0 6px;
      background: #fff; }
    .cw-jump { position: absolute; left: 50%; bottom: 118px; transform: translateX(-50%);
      border: 1px solid #dbe0ff; background: #fff; color: #4f46e5; font-size: 11.5px; padding: 5px 11px;
      border-radius: 999px; cursor: pointer; box-shadow: 0 3px 12px rgba(60,60,120,.16);
      display: none; font-family: inherit; z-index: 3; }
    .cw-jump.cw-show { display: block; }
    .cw-toast { position: absolute; left: 50%; bottom: 96px; transform: translateX(-50%);
      background: rgba(30,30,45,.94); color: #fff; font-size: 12px; padding: 7px 13px;
      border-radius: 8px; max-width: 86%; text-align: center; z-index: 6; }
    .cw-typing { display: inline-flex; gap: 4px; align-items: center; padding: 3px 0; }
    .cw-typing i { width: 6px; height: 6px; border-radius: 50%; background: #a5a5b5;
      animation: cw-blink 1.2s infinite ease-in-out; }
    .cw-typing i:nth-child(2) { animation-delay: .15s; }
    .cw-typing i:nth-child(3) { animation-delay: .3s; }
    @keyframes cw-blink { 0%, 60%, 100% { opacity: .3; transform: translateY(0); }
      30% { opacity: 1; transform: translateY(-3px); } }
    @media (max-width: 480px) {
      .cw-root { right: 12px; bottom: 12px; }
      .cw-panel { right: 10px; left: 10px; width: auto; bottom: 84px; height: min(72vh, 560px); }
      .cw-bubble { max-width: 96%; }
    }
    @media (prefers-reduced-motion: reduce) {
      .cw-fab, .cw-panel, .cw-typing i, .cw-send, .cw-msgs, .cw-tool-card {
        animation: none !important; transition: none !important; scroll-behavior: auto !important; }
    }
  `);
  // ---------------------------------------------------------------- DOM 结构
  const markup = `
    <div class="cw-root">
      <button class="cw-fab" type="button" aria-label="打开 AI 助手对话"></button>
      <div class="cw-panel" role="dialog" aria-label="AI 助手对话">
        <div class="cw-head">
          <button class="cw-icon-btn cw-menu" type="button" aria-label="对话列表">☰</button>
          <img class="cw-head-avatar" alt="" hidden />
          <div class="cw-head-main">
            <div class="cw-head-title"></div>
            <div class="cw-head-sub">AI 助手 · 由站主配置</div>
          </div>
          <button class="cw-icon-btn cw-close" type="button" aria-label="关闭对话">✕</button>
        </div>
        <div class="cw-msgs"></div>
        <button class="cw-jump" type="button">↓ 回到底部</button>
        <div class="cw-models" hidden></div>
        <div class="cw-input-row">
          <textarea class="cw-input" rows="1" placeholder="输入消息，Enter 发送 / Shift+Enter 换行"></textarea>
          <button class="cw-send" type="button" aria-label="发送"></button>
        </div>
        <div class="cw-foot">内容由 AI 生成，仅供参考</div>
        <div class="cw-drawer" role="dialog" aria-label="对话列表">
          <div class="cw-drawer-panel">
            <div class="cw-drawer-head">
              <span class="cw-drawer-title">对话记录</span>
              <button class="cw-icon-btn cw-drawer-close" type="button" aria-label="关闭列表">✕</button>
            </div>
            <button class="cw-new-chat" type="button">＋ 新建对话</button>
            <div class="cw-sess-list"></div>
          </div>
        </div>
      </div>
    </div>
  `;
  const host = document.createElement("div");
  host.id = "chat-widget-host";
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const styleEl = document.createElement("style");
  styleEl.textContent = css.join("");
  shadow.appendChild(styleEl);
  const holder = document.createElement("div");
  holder.innerHTML = markup;
  shadow.appendChild(holder.firstElementChild);

  const $ = (sel) => shadow.querySelector(sel);
  const fab = $(".cw-fab");
  const panel = $(".cw-panel");
  const msgs = $(".cw-msgs");
  const input = $(".cw-input");
  const sendBtn = $(".cw-send");
  const closeBtn = $(".cw-close");
  const menuBtn = $(".cw-menu");
  const drawer = $(".cw-drawer");
  const sessList = $(".cw-sess-list");
  const jumpBtn = $(".cw-jump");

  let open = false;
  let sending = false;
  let greeted = false;
  let controller = null;
  let state = loadState();
  let currentAudio = null;
  // ------------------------------------------------------------ 会话访问
  function activeSession() {
    return state.sessions.find((s) => s.id === state.activeId) || state.sessions[0];
  }

  function saveActive() {
    const s = activeSession();
    if (s) s.updatedAt = Date.now();
    persist(state);
  }

  function deriveTitle(text) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    return t.length > 16 ? t.slice(0, 16) + "…" : t || "新对话";
  }

  // ------------------------------------------------------------ 工具卡片
  const toolDescCache = Object.create(null);
  function toolMeta(path) {
    if (path in toolDescCache) return toolDescCache[path];
    return (toolDescCache[path] = { desc: "" });
  }

  function loadToolMeta() {
    const base = cfg.api.replace(/\/[^/]*$/, "");
    fetch(base + "/tools")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.tools)) return;
        data.tools.forEach((t) => {
          if (t && typeof t.path === "string") {
            toolDescCache[t.path] = { desc: String(t.desc || ""), title: String(t.title || "") };
          }
        });
      })
      .catch(() => {
        // 元数据拉取失败不影响主流程，卡片退化为仅标题
      });
  }

  function buildToolCard(a, path, label) {
    const target = cfg.toolsBase + path;
    const card = document.createElement("a");
    card.className = "cw-tool-card";
    card.href = target;
    if (/^https?:\/\//i.test(target)) {
      card.target = "_blank";
      card.rel = "noopener noreferrer";
    }
    const dot = document.createElement("div");
    dot.className = "cw-tool-dot";
    dot.textContent = String(label || "工").slice(0, 1);
    const body = document.createElement("div");
    body.className = "cw-tool-body";
    const title = document.createElement("div");
    title.className = "cw-tool-title";
    title.textContent = label || path;
    body.appendChild(title);
    const meta = toolMeta(path);
    if (meta.desc) {
      const desc = document.createElement("div");
      desc.className = "cw-tool-desc";
      desc.textContent = meta.desc;
      body.appendChild(desc);
    }
    const arrow = document.createElement("span");
    arrow.className = "cw-tool-arrow";
    arrow.textContent = "→";
    card.appendChild(dot);
    card.appendChild(body);
    card.appendChild(arrow);
    a.replaceWith(card);
  }

  // 把站内相对链接升级成卡片（在 HTML 插入后调用）
  function upgradeToolLinks(container) {
    container.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (!href.startsWith("/") || href.startsWith("//")) return;
      const path = href.split("?")[0].split("#")[0];
      if (!/^\/[a-z0-9-]+$/i.test(path)) return;
      buildToolCard(a, path, a.textContent || path);
    });
  }
  // ------------------------------------------------------------ 消息渲染
  function makeRow(kind) {
    const row = document.createElement("div");
    row.className = "cw-row cw-" + kind;
    return row;
  }

  function makeBubble(kind) {
    const row = makeRow(kind);
    const bubble = document.createElement("div");
    bubble.className = "cw-bubble";
    row.appendChild(bubble);
    msgs.appendChild(row);
    return { row, bubble };
  }

  function setBubbleHTML(bubble, text) {
    bubble.innerHTML = renderMarkdown(text);
    upgradeToolLinks(bubble);
    bubble.querySelectorAll(".cw-copy-code").forEach((btn) => {
      btn.addEventListener("click", () => {
        const code = btn.closest(".cw-code")?.querySelector("code");
        copyText(code ? code.textContent : "").then((ok) => {
          btn.textContent = ok ? "已复制" : "复制失败";
          setTimeout(() => (btn.textContent = "复制"), 1400);
        });
      });
    });
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        () => true,
        () => fallbackCopy(text)
      );
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }
  // ------------------------------------------------------------ 操作条
  function makeActions(msg, row, opts) {
    const bar = document.createElement("div");
    bar.className = "cw-actions";
    const add = (label, title, handler) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cw-act";
      b.textContent = label;
      b.title = title;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        handler(b);
      });
      bar.appendChild(b);
      return b;
    };

    add("复制", "复制回答", (b) => {
      copyText(msg.content).then((ok) => {
        b.textContent = ok ? "已复制" : "复制失败";
        setTimeout(() => (b.textContent = "复制"), 1400);
      });
    });
    add("朗读", "朗读这段回答", (b) => speak(b, msg.content));
    if (opts && opts.last) {
      add("重答", "重新生成回答", () => regenerate());
    }
    add("👍", "有帮助", (b) => {
      b.classList.toggle("cw-on");
      const down = bar.querySelector(".cw-act.cw-down");
      if (down) down.classList.remove("cw-on");
    });
    const down = add("👎", "没帮助", (b) => {
      b.classList.add("cw-down");
      b.classList.toggle("cw-on");
      const up = bar.querySelector(".cw-act.cw-up");
      if (up) up.classList.remove("cw-on");
    });
    down.classList.add("cw-down");
    row.appendChild(bar);
    return bar;
  }
  // ------------------------------------------------------------ 语音朗读
  const MAX_TTS_CHARS = 1500;

  function stopAudio() {
    if (currentAudio) {
      try {
        currentAudio.pause();
      } catch (e) {
        // 忽略
      }
      currentAudio = null;
    }
  }

  async function speak(btn, text) {
    if (currentAudio && btn.classList.contains("cw-on")) {
      stopAudio();
      btn.classList.remove("cw-on");
      btn.textContent = "朗读";
      return;
    }
    stopAudio();
    btn.classList.add("cw-on");
    btn.textContent = "合成中…";
    const clipped = text.length > MAX_TTS_CHARS ? text.slice(0, MAX_TTS_CHARS) : text;
    try {
      const resp = await fetch(cfg.tts, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments: [{ text: clipped, mode: "preset", voice: cfg.voice }] }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data && data.error ? data.error : "语音合成失败");
      if (!data.audio) throw new Error("未返回音频数据");
      const audio = new Audio("data:audio/wav;base64," + data.audio);
      currentAudio = audio;
      btn.textContent = "停止";
      audio.onended = () => {
        if (currentAudio === audio) currentAudio = null;
        btn.classList.remove("cw-on");
        btn.textContent = "朗读";
      };
      audio.onerror = () => {
        if (currentAudio === audio) currentAudio = null;
        btn.classList.remove("cw-on");
        btn.textContent = "朗读";
      };
      await audio.play();
      if (text.length > MAX_TTS_CHARS) {
        btn.title = "文本较长，仅朗读前 " + MAX_TTS_CHARS + " 字";
      }
    } catch (err) {
      btn.classList.remove("cw-on");
      btn.textContent = "朗读";
      const msg = (err && err.message) || "语音合成失败";
      showToast(msg);
    }
  }

  function showToast(text) {
    const t = document.createElement("div");
    t.className = "cw-toast";
    t.textContent = text;
    panel.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }
  // ------------------------------------------------------------ 会话列表
  function renderSessionList() {
    sessList.innerHTML = "";
    const sorted = state.sessions.slice().sort((a, b) => b.updatedAt - a.updatedAt);
    sorted.forEach((s) => {
      const item = document.createElement("div");
      item.className = "cw-sess" + (s.id === state.activeId ? " cw-active" : "");
      const name = document.createElement("div");
      name.className = "cw-sess-name";
      name.textContent = s.title || "新对话";
      const del = document.createElement("button");
      del.type = "button";
      del.className = "cw-sess-del";
      del.textContent = "✕";
      del.title = "删除该对话";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteSession(s.id);
      });
      item.appendChild(name);
      item.appendChild(del);
      item.addEventListener("click", () => switchSession(s.id));
      sessList.appendChild(item);
    });
  }

  function switchSession(id) {
    if (sending && controller) controller.abort();
    stopAudio();
    state.activeId = id;
    persist(state);
    renderMessages();
    closeDrawer();
  }

  function newSession() {
    if (sending && controller) controller.abort();
    stopAudio();
    const now = Date.now();
    const s = { id: newId(), title: "新对话", createdAt: now, updatedAt: now, messages: [] };
    state.sessions.unshift(s);
    state.activeId = s.id;
    if (state.sessions.length > MAX_SESSIONS) state.sessions.length = MAX_SESSIONS;
    persist(state);
    renderMessages();
    closeDrawer();
  }

  function deleteSession(id) {
    state.sessions = state.sessions.filter((s) => s.id !== id);
    if (state.sessions.length === 0) {
      const now = Date.now();
      state.sessions = [{ id: newId(), title: "新对话", createdAt: now, updatedAt: now, messages: [] }];
    }
    if (!state.sessions.some((s) => s.id === state.activeId)) {
      state.activeId = state.sessions[0].id;
    }
    persist(state);
    renderSessionList();
    renderMessages();
  }

  function openDrawer() {
    renderSessionList();
    drawer.classList.add("cw-show");
  }
  function closeDrawer() {
    drawer.classList.remove("cw-show");
  }
  // ------------------------------------------------------------ 渲染对话
  const QUICK_PROMPTS = [
    "这个站有哪些实用工具？",
    "帮我写一个匹配手机号的正则",
    "JSON 格式化有什么技巧？",
    "介绍一下站主的技术方向",
  ];

  function renderMessages() {
    msgs.innerHTML = "";
    const s = activeSession();
    const list = s ? s.messages : [];
    list.forEach((m, idx) => {
      const isLast = idx === list.length - 1 && m.role === "assistant";
      renderOne(m, { last: isLast });
    });
    if (list.length === 0) {
      renderWelcome();
    }
    scrollBottom(true);
  }

  function renderOne(m, opts) {
    const { row, bubble } = makeBubble(m.role === "user" ? "user" : "bot");
    if (m.role === "user") {
      bubble.textContent = m.content;
    } else {
      setBubbleHTML(bubble, m.content);
      makeActions(m, row, opts);
    }
    return { row, bubble };
  }

  function renderWelcome() {
    const { row, bubble } = makeBubble("bot");
    bubble.textContent = cfg.welcome;
    const quick = document.createElement("div");
    quick.className = "cw-quick";
    const label = document.createElement("div");
    label.className = "cw-quick-title";
    label.textContent = "可以试试这样问";
    quick.appendChild(label);
    QUICK_PROMPTS.forEach((p) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cw-quick-item";
      b.textContent = p;
      b.addEventListener("click", () => {
        input.value = p;
        autosize();
        handleSend();
      });
      quick.appendChild(b);
    });
    row.appendChild(quick);
  }
  // ------------------------------------------------------------ 滚动控制
  let stickBottom = true;
  function nearBottom() {
    return msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 60;
  }
  function scrollBottom(force) {
    if (force || stickBottom) {
      msgs.scrollTop = msgs.scrollHeight;
      jumpBtn.classList.remove("cw-show");
    }
  }
  msgs.addEventListener("scroll", () => {
    stickBottom = nearBottom();
    jumpBtn.classList.toggle("cw-show", !stickBottom && msgs.scrollHeight > msgs.clientHeight + 80);
  });
  jumpBtn.addEventListener("click", () => {
    stickBottom = true;
    scrollBottom(true);
  });

  // ------------------------------------------------------------ 发送消息
  function setSending(on) {
    sending = on;
    sendBtn.innerHTML = on ? ICON_STOP : ICON_SEND;
    sendBtn.setAttribute("aria-label", on ? "停止生成" : "发送");
    input.disabled = on;
    if (on) {
      const b = msgs.querySelector(".cw-typing");
      if (b) b.scrollIntoView({ block: "end" });
    }
  }

  function addTypingBubble() {
    const { row, bubble } = makeBubble("bot");
    const typing = document.createElement("span");
    typing.className = "cw-typing";
    typing.innerHTML = "<i></i><i></i><i></i>";
    bubble.appendChild(typing);
    scrollBottom();
    return { row, bubble, typing };
  }
  async function streamReply(history, targetBubble, onDone) {
    controller = new AbortController();
    let content = "";
    let rafId = 0;
    let pending = false;
    const flush = () => {
      rafId = 0;
      if (!pending) return;
      pending = false;
      setBubbleHTML(targetBubble, content);
      scrollBottom();
    };
    const schedule = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(flush);
    };
    try {
      const payload = { messages: history, stream: true };
      if (selectedModel) payload.model = selectedModel;
      const resp = await fetch(cfg.api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!resp.ok) {
        let msg = `请求失败（${resp.status}）`;
        try {
          const data = await resp.json();
          if (data && data.error) msg = data.error;
        } catch (e) {
          // 非 JSON 错误体
        }
        throw new Error(msg);
      }
      if (!resp.body) throw new Error("当前浏览器不支持流式响应");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const r = await reader.read();
        if (r.done) break;
        buf += decoder.decode(r.value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data) continue;
          if (data === "[DONE]") {
            done = true;
            break;
          }
          let obj;
          try {
            obj = JSON.parse(data);
          } catch (e) {
            continue;
          }
          if (obj && obj.error) throw new Error(obj.error);
          if (obj && typeof obj.delta === "string" && obj.delta) {
            content += obj.delta;
            pending = true;
            schedule();
          }
          if (obj && obj.done) done = true;
        }
      }
      if (rafId) cancelAnimationFrame(rafId);
      setBubbleHTML(targetBubble, content);
      scrollBottom();
      if (onDone) onDone(content);
      return content;
    } finally {
      controller = null;
    }
  }
  async function handleSend() {
    if (sending) {
      if (controller) controller.abort();
      return;
    }
    const text = input.value.trim();
    if (!text) return;
    const s = activeSession();
    if (!s) return;
    input.value = "";
    autosize();
    if (msgs.querySelector(".cw-quick")) renderMessages();

    s.messages.push({ role: "user", content: text, ts: Date.now() });
    if (s.title === "新对话") s.title = deriveTitle(text);
    renderMessages();
    setSending(true);
    const { row, bubble, typing } = addTypingBubble();
    let content = "";
    let started = false;
    try {
      content = await streamReply(
        s.messages.slice(-12).map((m) => ({ role: m.role, content: m.content })),
        bubble,
        null
      );
      typing.remove();
      if (!content) throw new Error("未收到回答");
      s.messages.push({ role: "assistant", content, ts: Date.now() });
      saveActive();
      renderMessages();
    } catch (err) {
      typing.remove();
      const aborted = err && err.name === "AbortError";
      if (content) {
        s.messages.push({ role: "assistant", content, ts: Date.now() });
        saveActive();
      }
      renderMessages();
      if (!aborted) {
        const { row: er } = makeBubble("error");
        er.querySelector(".cw-bubble").textContent =
          (err && err.message) || "发送失败，请稍后再试";
        scrollBottom();
      }
    } finally {
      if (typing.parentNode) typing.remove();
      setSending(false);
    }
  }

  function regenerate() {
    if (sending) return;
    const s = activeSession();
    if (!s) return;
    const msgsArr = s.messages;
    let lastUserIdx = -1;
    for (let i = msgsArr.length - 1; i >= 0; i -= 1) {
      if (msgsArr[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx < 0) return;
    s.messages = msgsArr.slice(0, lastUserIdx + 1);
    persist(state);
    renderMessages();
    setSending(true);
    const { bubble, typing } = addTypingBubble();
    streamReply(
      s.messages.slice(-12).map((m) => ({ role: m.role, content: m.content })),
      bubble
    )
      .then((content) => {
        typing.remove();
        if (content) {
          s.messages.push({ role: "assistant", content, ts: Date.now() });
          saveActive();
        }
        renderMessages();
      })
      .catch((err) => {
        typing.remove();
        renderMessages();
        if (err && err.name !== "AbortError") showToast((err && err.message) || "重答失败");
      })
      .finally(() => setSending(false));
  }
  // ------------------------------------------------------------ 交互绑定
  const ICON_SEND =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">' +
    '<path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
  const ICON_STOP =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">' +
    '<rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

  function setOpen(next) {
    open = next;
    panel.classList.toggle("cw-open", open);
    fab.setAttribute("aria-label", open ? "关闭 AI 助手对话" : "打开 AI 助手对话");
    if (open) {
      if (!greeted) {
        greeted = true;
        renderMessages();
      }
      setTimeout(() => input.focus(), 220);
    } else {
      closeDrawer();
      stopAudio();
    }
  }

  function setupAvatar() {
    if (cfg.avatar) {
      const img = document.createElement("img");
      img.src = cfg.avatar;
      img.alt = "";
      fab.appendChild(img);
      const headAvatar = $(".cw-head-avatar");
      headAvatar.src = cfg.avatar;
      headAvatar.hidden = false;
    } else {
      const emoji = document.createElement("span");
      emoji.className = "cw-fab-emoji";
      emoji.textContent = "🤖";
      fab.appendChild(emoji);
    }
    $(".cw-head-title").textContent = cfg.title;
  }

  function setupModels() {
    if (cfg.models.length <= 1) return;
    const box = $(".cw-models");
    box.hidden = false;
    cfg.models.forEach((m) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "cw-model-chip";
      chip.textContent = m.label;
      chip.dataset.model = m.id;
      chip.addEventListener("click", () => {
        selectedModel = m.id;
        box.querySelectorAll(".cw-model-chip").forEach((el) => {
          el.classList.toggle("cw-active", el.dataset.model === selectedModel);
        });
      });
      box.appendChild(chip);
    });
    const first = box.querySelector(".cw-model-chip");
    if (first) first.classList.add("cw-active");
  }

  function autosize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 104) + "px";
  }
  fab.addEventListener("click", () => setOpen(!open));
  closeBtn.addEventListener("click", () => setOpen(false));
  menuBtn.addEventListener("click", openDrawer);
  $(".cw-drawer-close").addEventListener("click", closeDrawer);
  $(".cw-new-chat").addEventListener("click", newSession);
  drawer.addEventListener("click", (e) => {
    if (e.target === drawer) closeDrawer();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (drawer.classList.contains("cw-show")) return closeDrawer();
    if (open) setOpen(false);
  });
  input.addEventListener("input", autosize);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      handleSend();
    }
  });
  sendBtn.addEventListener("click", handleSend);

  setupAvatar();
  setupModels();
  setSending(false);
  if (state.sessions.length === 0) state = emptyState();
  renderMessages();
  loadToolMeta();
  // __CW_END__
})();

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
    avatar: attr("data-avatar") || "",
    title: attr("data-title") || "小雷助手",
    welcome: attr("data-welcome") || "你好，我是小雷助手，有什么可以帮你的吗？",
    models: parseModels(attr("data-models")),
  };
  let selectedModel = cfg.models.length > 0 ? cfg.models[0].id : "";

  const css = [];
  css.push(`
    :host { all: initial; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .cw-root { position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif; }
    .cw-fab { width: 56px; height: 56px; border-radius: 50%; border: none; padding: 0; cursor: pointer;
      overflow: hidden; display: block; background: linear-gradient(135deg, #6366f1, #a855f7);
      box-shadow: 0 6px 24px rgba(60,60,120,.28); transition: transform .2s ease, box-shadow .2s ease;
      animation: cw-pop .5s cubic-bezier(.34,1.56,.64,1); }
    .cw-fab:hover { transform: scale(1.08); box-shadow: 0 8px 28px rgba(60,60,120,.36); }
    .cw-fab:active { transform: scale(.96); }
    .cw-fab img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .cw-fab-emoji { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
      font-size: 28px; color: #fff; }
    @keyframes cw-pop { 0% { opacity: 0; transform: scale(.4) translateY(16px); } 100% { opacity: 1; transform: none; } }
  `);
  css.push(`
    .cw-panel { position: fixed; right: 20px; bottom: 92px; width: min(370px, calc(100vw - 24px));
      height: min(540px, calc(100vh - 130px)); background: #fff; border-radius: 16px;
      border: 1px solid rgba(99,102,241,.12); box-shadow: 0 12px 48px rgba(20,20,50,.22);
      display: flex; flex-direction: column; overflow: hidden; opacity: 0;
      transform: translateY(14px) scale(.97); pointer-events: none;
      transition: opacity .22s ease, transform .22s ease; }
    .cw-panel.cw-open { opacity: 1; transform: none; pointer-events: auto; }
    .cw-head { display: flex; align-items: center; gap: 10px; padding: 12px 14px; flex: none;
      background: linear-gradient(135deg, #eef2ff, #f5f0ff); border-bottom: 1px solid #ececf2; }
    .cw-head-avatar { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; }
    .cw-head-main { flex: 1; min-width: 0; }
    .cw-head-title { font-size: 15px; font-weight: 600; color: #1c1c26; }
    .cw-head-sub { font-size: 12px; color: #8a8a96; margin-top: 1px; }
    .cw-close { border: none; background: transparent; font-size: 16px; line-height: 1; color: #6b6b78;
      cursor: pointer; padding: 6px 8px; border-radius: 8px; }
    .cw-close:hover { background: rgba(0,0,0,.06); color: #1c1c26; }
  `);
  css.push(`
    .cw-msgs { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column;
      gap: 10px; background: #f7f7fb; }
    .cw-row { display: flex; }
    .cw-user { justify-content: flex-end; }
    .cw-bubble { max-width: 84%; padding: 9px 12px; border-radius: 13px; font-size: 14px;
      line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
    .cw-bot .cw-bubble { background: #fff; border: 1px solid #e8e8f0; color: #23232e;
      border-top-left-radius: 4px; }
    .cw-user .cw-bubble { background: linear-gradient(135deg, #6366f1, #7c5cf6); color: #fff;
      border-top-right-radius: 4px; }
    .cw-error .cw-bubble { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }
    .cw-typing { display: inline-flex; gap: 4px; align-items: center; padding: 4px 0; }
    .cw-typing i { width: 6px; height: 6px; border-radius: 50%; background: #a5a5b5;
      animation: cw-blink 1.2s infinite ease-in-out; }
    .cw-typing i:nth-child(2) { animation-delay: .15s; }
    .cw-typing i:nth-child(3) { animation-delay: .3s; }
    @keyframes cw-blink { 0%, 60%, 100% { opacity: .3; transform: translateY(0); }
      30% { opacity: 1; transform: translateY(-3px); } }
    .cw-caret::after { content: "▍"; color: #6366f1; animation: cw-caret-blink .9s steps(1) infinite; }
    @keyframes cw-caret-blink { 50% { opacity: 0; } }
  `);
  css.push(`
    .cw-input-row { flex: none; display: flex; align-items: flex-end; gap: 8px; padding: 10px 12px;
      background: #fff; border-top: 1px solid #ececf2; }
    .cw-input { flex: 1; resize: none; border: 1px solid #e2e2ec; border-radius: 10px; padding: 8px 10px;
      font-size: 14px; line-height: 1.5; max-height: 96px; outline: none; background: #fafafc;
      color: #23232e; font-family: inherit; transition: border-color .15s ease, box-shadow .15s ease; }
    .cw-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.15); background: #fff; }
    .cw-send { flex: none; width: 36px; height: 36px; border-radius: 10px; border: none; color: #fff;
      background: linear-gradient(135deg, #6366f1, #7c5cf6); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: opacity .15s ease, transform .15s ease; }
    .cw-send:hover { transform: translateY(-1px); }
    .cw-send:disabled { opacity: .45; cursor: default; transform: none; }
    .cw-foot { flex: none; text-align: center; font-size: 11px; color: #a2a2ae; padding: 5px 0 7px;
      background: #fff; }
    @media (max-width: 480px) {
      .cw-root { right: 12px; bottom: 12px; }
      .cw-panel { right: 10px; left: 10px; width: auto; bottom: 84px; height: min(60vh, 480px); }
    }
    @media (prefers-reduced-motion: reduce) {
      .cw-fab, .cw-panel, .cw-typing i, .cw-caret::after, .cw-send {
        animation: none !important; transition: none !important; }
    }
  `);
  css.push(`
    .cw-models { flex: none; display: flex; gap: 6px; padding: 8px 12px 0; background: #fff; }
    .cw-model-chip { border: 1px solid #e2e2ec; background: #fafafc; color: #5a5a68; font-size: 12px;
      padding: 3px 10px; border-radius: 999px; cursor: pointer; font-family: inherit;
      transition: border-color .15s ease, color .15s ease, background .15s ease; }
    .cw-model-chip:hover { border-color: #6366f1; color: #6366f1; }
    .cw-model-chip.cw-active { background: #eef2ff; border-color: #6366f1; color: #6366f1; font-weight: 600; }
  `);
  const markup = `
    <div class="cw-root">
      <button class="cw-fab" aria-label="打开 AI 助手对话"></button>
      <div class="cw-panel" role="dialog" aria-label="AI 助手对话">
        <div class="cw-head">
          <img class="cw-head-avatar" alt="" hidden />
          <div class="cw-head-main">
            <div class="cw-head-title"></div>
            <div class="cw-head-sub">AI 助手 · 由站主配置</div>
          </div>
          <button class="cw-close" aria-label="关闭对话">✕</button>
        </div>
        <div class="cw-msgs"></div>
        <div class="cw-models" hidden></div>
        <div class="cw-input-row">
          <textarea class="cw-input" rows="1" placeholder="输入消息，Enter 发送"></textarea>
          <button class="cw-send" type="button" aria-label="发送"></button>
        </div>
        <div class="cw-foot">内容由 AI 生成，仅供参考</div>
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

  let open = false;
  let sending = false;
  let welcomed = false;
  let controller = null;
  const history = [];
  const ICON_SEND =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">' +
    '<path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
  const ICON_STOP =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">' +
    '<rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

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

  function scrollBottom() {
    msgs.scrollTop = msgs.scrollHeight;
  }

  function addBubble(kind, text) {
    const row = document.createElement("div");
    row.className = "cw-row cw-" + kind;
    const bubble = document.createElement("div");
    bubble.className = "cw-bubble";
    if (text != null) bubble.textContent = text;
    row.appendChild(bubble);
    msgs.appendChild(row);
    scrollBottom();
    return bubble;
  }

  function addTypingBubble() {
    const bubble = addBubble("bot", null);
    const typing = document.createElement("span");
    typing.className = "cw-typing";
    typing.innerHTML = "<i></i><i></i><i></i>";
    bubble.appendChild(typing);
    scrollBottom();
    return { bubble, typing };
  }
  function setOpen(next) {
    open = next;
    panel.classList.toggle("cw-open", open);
    fab.setAttribute("aria-label", open ? "关闭 AI 助手对话" : "打开 AI 助手对话");
    if (open) {
      if (!welcomed) {
        welcomed = true;
        addBubble("bot", cfg.welcome);
      }
      setTimeout(() => input.focus(), 220);
    }
  }

  fab.addEventListener("click", () => setOpen(!open));
  closeBtn.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) setOpen(false);
  });

  function setSending(on) {
    sending = on;
    sendBtn.innerHTML = on ? ICON_STOP : ICON_SEND;
    sendBtn.setAttribute("aria-label", on ? "停止生成" : "发送");
    input.disabled = on;
  }
  async function handleSend() {
    if (sending) {
      if (controller) controller.abort();
      return;
    }
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    autosize();
    history.push({ role: "user", content: text });
    addBubble("user", text);
    setSending(true);
    controller = new AbortController();
    const { bubble, typing } = addTypingBubble();
    let content = "";
    let started = false;
    const applyDelta = (delta) => {
      if (typing.parentNode) typing.remove();
      if (!started) {
        started = true;
        bubble.classList.add("cw-caret");
      }
      content += delta;
      bubble.textContent = content;
      scrollBottom();
    };
    try {
      const payload = { messages: history.slice(-12), stream: true };
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
          // 非 JSON 错误体时保留默认提示
        }
        throw new Error(msg);
      }
      if (!resp.body) throw new Error("当前浏览器不支持流式响应");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buf += decoder.decode(value, { stream: true });
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
          if (obj && typeof obj.delta === "string" && obj.delta) applyDelta(obj.delta);
          if (obj && obj.done) done = true;
        }
      }
      bubble.classList.remove("cw-caret");
      if (content) history.push({ role: "assistant", content });
      else bubble.remove();
    } catch (err) {
      bubble.classList.remove("cw-caret");
      const aborted = err && err.name === "AbortError";
      const hint = aborted ? "" : err && err.message ? err.message : "发送失败，请稍后再试";
      if (content) {
        history.push({ role: "assistant", content });
        if (!aborted) addBubble("error", hint);
      } else {
        bubble.remove();
        if (!aborted) addBubble("error", hint);
      }
    }
    finally {
      if (typing.parentNode) typing.remove();
      setSending(false);
      controller = null;
      scrollBottom();
    }
  }
  function autosize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 96) + "px";
  }
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
  // __CW_END__
})();

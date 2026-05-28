// ═══════════════════════════════════════════════════════════════
//  TERMINAL PANEL — terminal.js
//  Toggle : Ctrl + J
//  Deps   : preload.js  (electronAPI.terminalExec / Get/SetCwd)
// ═══════════════════════════════════════════════════════════════

const TerminalPanel = (() => {
  let visible = false;
  let history = [];
  let histIdx = -1;
  let cwd = "";

  const MAX_LINES = 500; // max DOM children in output — prevents memory growth

  // ── Tiny helpers ─────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function shortCwd(p) {
    if (!p) return "~";
    const parts = p.replace(/\\/g, "/").split("/").filter(Boolean);
    if (parts.length === 0) return "/";
    return parts.length <= 2
      ? parts.join("/")
      : "…/" + parts.slice(-2).join("/");
  }

  function setPrompt(newCwd) {
    if (newCwd) cwd = newCwd;
    const el = $("terminal-prompt");
    if (el) el.textContent = shortCwd(cwd) + " ❯ ";
  }

  function append(html) {
    const out = $("terminal-output");
    if (!out) return;
    out.insertAdjacentHTML("beforeend", html);
    // Trim oldest lines so DOM stays bounded
    while (out.children.length > MAX_LINES) out.removeChild(out.firstChild);
    out.scrollTop = out.scrollHeight;
  }

  // ── Run a command ─────────────────────────────────────────────
  async function runCmd(raw) {
    const cmd = raw.trim();
    if (!cmd) return;

    // History
    history.unshift(cmd);
    if (history.length > 100) history.pop();
    histIdx = -1;

    append(`<div class="term-cmd">❯ ${esc(cmd)}</div>`);

    // Special: clear
    if (cmd === "clear" || cmd === "cls") {
      clearOutput();
      return;
    }

    try {
      const res = await window.electronAPI.terminalExec(cmd);
      if (res.cwd) setPrompt(res.cwd);
      if (res.stdout)
        append(`<div class="term-stdout">${esc(res.stdout)}</div>`);
      if (res.stderr)
        append(`<div class="term-stderr">${esc(res.stderr)}</div>`);
    } catch (err) {
      append(`<div class="term-stderr">${esc(String(err))}</div>`);
    }
  }

  // ── Input keydown ─────────────────────────────────────────────
  function onKey(e) {
    const inp = $("terminal-input");
    if (e.key === "Enter") {
      const cmd = inp.value;
      inp.value = "";
      runCmd(cmd);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (histIdx < history.length - 1) {
        histIdx++;
        inp.value = history[histIdx] || "";
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx > 0) {
        histIdx--;
        inp.value = history[histIdx] || "";
      } else {
        histIdx = -1;
        inp.value = "";
      }
    } else if (e.ctrlKey && e.key === "l") {
      e.preventDefault();
      clearOutput();
    }
  }

  function clearOutput() {
    const out = $("terminal-output");
    if (out) out.innerHTML = "";
  }

  // ── Terminal panel resize (drag top edge) ─────────────────────
  (function initResize() {
    let dragging = false,
      startY = 0,
      startH = 0;
    const panel = () => $("terminal-panel");

    document.addEventListener("mousedown", (e) => {
      const handle = $("tp-resize");
      if (!handle || e.target !== handle) return;
      dragging = true;
      startY = e.clientY;
      startH = panel()?.offsetHeight || 240;
      document.body.style.userSelect = "none";
      document.body.style.cursor = "row-resize";
    });
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const newH = Math.min(Math.max(startH - (e.clientY - startY), 80), 600);
      const p = panel();
      if (p) p.style.height = newH + "px";
    });
    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    });
  })();

  // ── Show / Hide / Toggle ──────────────────────────────────────
  async function show() {
    if (visible) return;
    visible = true;
    $("terminal-panel")?.classList.add("tp-visible");

    // Get current working directory on first open
    if (!cwd && window.electronAPI.terminalGetCwd) {
      const dir = await window.electronAPI.terminalGetCwd();
      setPrompt(dir);
    } else {
      setPrompt();
    }

    setTimeout(() => $("terminal-input")?.focus(), 40);
  }

  function hide() {
    if (!visible) return;
    visible = false;
    $("terminal-panel")?.classList.remove("tp-visible");
    window.editor?.focus();
  }

  function toggle() {
    visible ? hide() : show();
  }

  // ── Set cwd (called when a folder is opened in explorer) ──────
  function setCwd(dir) {
    cwd = dir;
    setPrompt(dir);
    window.electronAPI?.terminalSetCwd?.(dir);
  }

  // ── Wire up DOM events ────────────────────────────────────────
  $("terminal-close-btn")?.addEventListener("click", hide);
  $("terminal-clear-btn")?.addEventListener("click", clearOutput);
  $("terminal-input")?.addEventListener("keydown", onKey);
  $("terminal-output")?.addEventListener("click", () =>
    $("terminal-input")?.focus(),
  );

  // ── Global shortcut (works when Monaco doesn't have focus) ───
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && !e.shiftKey && e.key === "j") {
      e.preventDefault();
      toggle();
    }
  });

  // ── Monaco shortcut (when editor has focus) ──────────────────
  document.addEventListener("monaco-ready", () => {
    window.editor?.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ, () =>
      toggle(),
    );
  });

  return { show, hide, toggle, setCwd };
})();

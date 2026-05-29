// ═══════════════════════════════════════════════════════════════
//  TERMINAL PANEL v2 — terminal.js
//  Renderer: xterm.js v4   Backend: node-pty or spawn fallback
//  Toggle : Ctrl + J
// ═══════════════════════════════════════════════════════════════

const TerminalPanel = (() => {
  // ── xterm globals (set before Monaco via <script> tag order) ──
  // xterm v4 UMD assigns: window.Terminal = class Terminal
  // xterm-addon-fit UMD assigns: window.FitAddon = { FitAddon: class }
  const getTermCtor  = () => window.Terminal?.Terminal || window.Terminal;
  const getFitCtor   = () => window.FitAddon?.FitAddon  || window.FitAddon;

  let term        = null;
  let fitAddon    = null;
  let visible     = false;
  let initialized = false;
  let ptyReady    = false;
  let resizeObs   = null;

  const $ = (id) => document.getElementById(id);

  // ── Initialise xterm instance ─────────────────────────────────
  async function init() {
    if (initialized) return;
    initialized = true;

    const TermCtor = getTermCtor();
    if (!TermCtor) {
      console.warn("[Terminal] xterm.js not found on window. Check script load order.");
      return;
    }

    const FitCtor = getFitCtor();

    // GitHub Dark terminal theme
    term = new TermCtor({
      cursorBlink:     true,
      cursorStyle:     "block",
      fontSize:        13,
      fontFamily:      '"Cascadia Code", "Fira Code", Consolas, monospace',
      fontWeight:      "normal",
      lineHeight:      1.35,
      letterSpacing:   0,
      scrollback:      5000,
      convertEol:      true,
      allowTransparency: false,
      theme: {
        background:    "#0d1117",
        foreground:    "#e6edf3",
        cursor:        "#58a6ff",
        cursorAccent:  "#0d1117",
        selectionBackground: "rgba(56,139,253,0.30)",
        black:         "#484f58",
        red:           "#ff7b72",
        green:         "#3fb950",
        yellow:        "#d29922",
        blue:          "#58a6ff",
        magenta:       "#a371f7",
        cyan:          "#76e3ea",
        white:         "#b1bac4",
        brightBlack:   "#6e7681",
        brightRed:     "#ffa198",
        brightGreen:   "#56d364",
        brightYellow:  "#e3b341",
        brightBlue:    "#79c0ff",
        brightMagenta: "#d2a8ff",
        brightCyan:    "#87deea",
        brightWhite:   "#ffffff",
      },
    });

    // FitAddon
    if (FitCtor) {
      fitAddon = new FitCtor();
      term.loadAddon(fitAddon);
    }

    // Mount into DOM
    const container = $("terminal-xterm");
    if (!container) { console.error("[Terminal] #terminal-xterm missing"); return; }
    term.open(container);

    // Initial fit (needs brief paint delay)
    requestAnimationFrame(() => { fitAddon?.fit(); });

    // Welcome message (cleared once PTY starts — just so screen isn't blank)
    term.writeln("\x1b[90m» Connecting to shell…\x1b[0m");

    // Start shell PTY
    await startPty();

    // Send user input to PTY
    term.onData((data) => {
      window.electronAPI.ptyWrite(data);
    });

    // Receive shell output
    window.electronAPI.onPtyData((data) => {
      term.write(data);
    });

    // Shell process exited
    window.electronAPI.onPtyExit((code) => {
      term.writeln(`\r\n\x1b[33m[Process exited with code ${code ?? 0}]\x1b[0m`);
      term.writeln("\x1b[90mPress Enter to start a new shell.\x1b[0m");
      ptyReady = false;

      // Restart on Enter
      const disp = term.onKey(({ key }) => {
        if (key === "\r") {
          disp.dispose();
          term.writeln("");
          startPty();
        }
      });
    });

    // Notify PTY of terminal dimension changes
    term.onResize(({ cols, rows }) => {
      if (ptyReady) window.electronAPI.ptyResize({ cols, rows });
    });

    // Auto-fit when panel is resized
    if (window.ResizeObserver) {
      resizeObs = new ResizeObserver(() => {
        if (fitAddon && visible) requestAnimationFrame(() => fitAddon.fit());
      });
      resizeObs.observe(container);
    }
  }

  // ── Start (or restart) the shell process ─────────────────────
  async function startPty() {
    ptyReady = false;
    const cwd  = await window.electronAPI.terminalGetCwd?.() ?? "";
    const cols = term?.cols  ?? 80;
    const rows = term?.rows  ?? 24;

    const result = await window.electronAPI.ptyCreate({ cols, rows, cwd });

    if (result?.success === false) {
      term?.writeln(`\r\n\x1b[31m[Failed to start shell: ${result.error}]\x1b[0m`);
      return;
    }

    ptyReady = true;

    // Show shell name badge
    if (result?.shell) {
      const badge = $("tp-shell-name");
      if (badge) badge.textContent = result.shell;
    }
  }

  // ── Terminal panel resize (drag top edge) ─────────────────────
  (function initResizeDrag() {
    let dragging = false, startY = 0, startH = 0;
    const panel  = () => $("terminal-panel");

    document.addEventListener("mousedown", (e) => {
      if (e.target !== $("tp-resize")) return;
      dragging = true;
      startY   = e.clientY;
      startH   = panel()?.offsetHeight ?? 260;
      document.body.style.userSelect = "none";
      document.body.style.cursor     = "row-resize";
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const newH = Math.min(Math.max(startH - (e.clientY - startY), 100), 640);
      const p = panel();
      if (p) p.style.height = newH + "px";
    });

    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = "";
      document.body.style.cursor     = "";
      // Re-fit after drag ends
      requestAnimationFrame(() => fitAddon?.fit());
    });
  })();

  // ── Show ──────────────────────────────────────────────────────
  async function show() {
    if (visible) return;
    visible = true;
    $("terminal-panel")?.classList.add("tp-visible");

    if (!initialized) {
      // Wait one tick for panel to enter the layout before measuring
      setTimeout(() => init(), 30);
    } else {
      setTimeout(() => {
        fitAddon?.fit();
        term?.focus();
      }, 40);
    }
  }

  // ── Hide ──────────────────────────────────────────────────────
  function hide() {
    if (!visible) return;
    visible = false;
    $("terminal-panel")?.classList.remove("tp-visible");
    window.editor?.focus();
  }

  function toggle() { visible ? hide() : show(); }

  // ── Clear ─────────────────────────────────────────────────────
  function clear() { term?.clear(); }

  // ── Set CWD (called when explorer opens a folder) ─────────────
  function setCwd(dir) {
    window.electronAPI?.terminalSetCwd?.(dir);
  }

  // ── Wire DOM buttons ──────────────────────────────────────────
  $("terminal-close-btn")?.addEventListener("click", hide);
  $("terminal-clear-btn")?.addEventListener("click", clear);
  $("terminal-new-btn")?.addEventListener("click",  async () => {
    term?.writeln("\r\n\x1b[90m[New terminal session]\x1b[0m\r\n");
    await window.electronAPI.ptyKill();
    window.electronAPI.offPtyData?.();
    window.electronAPI.offPtyExit?.();
    window.electronAPI.onPtyData((data) => term.write(data));
    window.electronAPI.onPtyExit((code) => {
      term.writeln(`\r\n\x1b[33m[Exited ${code ?? 0}]\x1b[0m`);
      ptyReady = false;
    });
    await startPty();
  });

  // ── Global keyboard shortcut ──────────────────────────────────
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && !e.shiftKey && e.key === "j") {
      e.preventDefault();
      toggle();
    }
  });

  // ── Monaco shortcut (once editor is ready) ───────────────────
  document.addEventListener("monaco-ready", () => {
    window.editor?.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ,
      toggle
    );
  });

  return { show, hide, toggle, setCwd, clear };
})();

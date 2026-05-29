// ═══════════════════════════════════════════════════════════════
//  TERMINAL ENGINE — terminal.js
//  Manages xterm.js instance + PTY lifecycle.
//  Panel show/hide/resize is handled by BottomPanel (bottom-panel.js).
//  Shortcut: Ctrl+`  (backtick)
// ═══════════════════════════════════════════════════════════════

window.TerminalPanel = (() => {
  // xterm 5.x UMD global names
  const getTermCtor      = () => window.Terminal?.Terminal      || window.Terminal;
  const getFitCtor       = () => window.FitAddon?.FitAddon       || window.FitAddon;
  const getSearchCtor    = () => window.SearchAddon?.SearchAddon  || window.SearchAddon;
  const getWebLinksCtor  = () => window.WebLinksAddon?.WebLinksAddon || window.WebLinksAddon;
  const getUnicode11Ctor = () => window.Unicode11Addon?.Unicode11Addon || window.Unicode11Addon;

  let term        = null;
  let fitAddon    = null;
  let searchAddon = null;
  let initialized = false;
  let ptyReady    = false;

  // ── Init xterm instance ───────────────────────────────────────
  async function init() {
    if (initialized) return;
    initialized = true;

    const TermCtor = getTermCtor();
    if (!TermCtor) {
      console.warn('[Terminal] xterm.js not found. Check script load order.');
      return;
    }

    term = new TermCtor({
      cursorBlink:          true,
      cursorStyle:          'block',
      fontSize:             13,
      fontFamily:           '"Cascadia Code", "Fira Code", Consolas, monospace',
      fontWeight:           'normal',
      lineHeight:           1.35,
      letterSpacing:        0,
      scrollback:           10000,
      convertEol:           true,
      allowTransparency:    false,
      allowProposedApi:     true,
      macOptionIsMeta:      false,
      rightClickSelectsWord: true,
      overviewRulerWidth:   8,
      theme: {
        background:          '#0d1117',
        foreground:          '#e6edf3',
        cursor:              '#58a6ff',
        cursorAccent:        '#0d1117',
        selectionBackground: 'rgba(56,139,253,0.30)',
        selectionForeground: '#ffffff',
        selectionInactiveBackground: 'rgba(56,139,253,0.15)',
        black:               '#484f58',
        red:                 '#ff7b72',
        green:               '#3fb950',
        yellow:              '#d29922',
        blue:                '#58a6ff',
        magenta:             '#a371f7',
        cyan:                '#76e3ea',
        white:               '#b1bac4',
        brightBlack:         '#6e7681',
        brightRed:           '#ffa198',
        brightGreen:         '#56d364',
        brightYellow:        '#e3b341',
        brightBlue:          '#79c0ff',
        brightMagenta:       '#d2a8ff',
        brightCyan:          '#87deea',
        brightWhite:         '#ffffff',
      },
    });

    // ── Addons ────────────────────────────────────────────────
    const FitCtor = getFitCtor();
    if (FitCtor) {
      fitAddon = new FitCtor();
      term.loadAddon(fitAddon);
    }

    const SearchCtor = getSearchCtor();
    if (SearchCtor) {
      searchAddon = new SearchCtor();
      term.loadAddon(searchAddon);
    }

    const WebLinksCtor = getWebLinksCtor();
    if (WebLinksCtor) {
      term.loadAddon(new WebLinksCtor((e, uri) => {
        window.electronAPI?.openExternal?.(uri);
      }));
    }

    const Unicode11Ctor = getUnicode11Ctor();
    if (Unicode11Ctor) {
      const u11 = new Unicode11Ctor();
      term.loadAddon(u11);
      term.unicode.activeVersion = '11';
    }

    const container = document.getElementById('terminal-xterm');
    if (!container) { console.error('[Terminal] #terminal-xterm missing'); return; }
    term.open(container);

    // Initial fit after paint
    requestAnimationFrame(() => fitAddon?.fit());

    term.writeln('\x1b[90m» Connecting to shell…\x1b[0m');

    await startPty();

    // ── Input: user keystrokes → PTY ──────────────────────────
    term.onData((data) => {
      if (window.electronAPI?.ptyWrite) {
        window.electronAPI.ptyWrite(data);
      }
    });

    // ── Output: PTY data → terminal ───────────────────────────
    window.electronAPI?.onPtyData?.((data) => {
      term.write(data);
    });

    // ── PTY exited ────────────────────────────────────────────
    window.electronAPI?.onPtyExit?.((code) => {
      term.writeln(`\r\n\x1b[33m[Process exited — code ${code ?? 0}]\x1b[0m`);
      term.writeln('\x1b[90mPress Enter to start a new shell.\x1b[0m');
      ptyReady = false;

      const disp = term.onKey(({ key }) => {
        if (key === '\r') {
          disp.dispose();
          term.writeln('');
          startPty();
        }
      });
    });

    // ── Resize → notify PTY ───────────────────────────────────
    term.onResize(({ cols, rows }) => {
      if (ptyReady) window.electronAPI?.ptyResize?.({ cols, rows });
    });

    // ── Auto-fit when container resizes ──────────────────────
    if (window.ResizeObserver) {
      new ResizeObserver(() => {
        if (fitAddon) requestAnimationFrame(() => fitAddon.fit());
      }).observe(container);
    }

    // ── Re-focus xterm on any click inside the terminal pane ─
    // xterm renders an internal <textarea>; clicking the surrounding
    // container does NOT transfer focus to it automatically.
    document.getElementById('bp-pane-terminal')?.addEventListener('mousedown', (e) => {
      // Don't steal focus from the search bar or toolbar buttons
      if (e.target.closest('.term-search-bar, #bp-tabs, #bp-toolbar')) return;
      requestAnimationFrame(() => term?.focus());
    });

    // Wire "New Terminal" button
    document.getElementById('terminal-new-btn')?.addEventListener('click', newSession);
  }

  // ── Start / restart PTY ───────────────────────────────────────
  async function startPty() {
    ptyReady = false;
    if (!window.electronAPI?.ptyCreate) return;

    const cwd  = await window.electronAPI.terminalGetCwd?.() ?? '';
    const cols = term?.cols ?? 80;
    const rows = term?.rows ?? 24;

    const result = await window.electronAPI.ptyCreate({ cols, rows, cwd });

    if (result?.success === false) {
      term?.writeln(`\r\n\x1b[31m[Failed to start shell: ${result.error}]\x1b[0m`);
      term?.writeln('\x1b[90mTip: Install Git for Windows to get bash support.\x1b[0m');
      return;
    }

    ptyReady = true;

    const badge = document.getElementById('tp-shell-name');
    if (badge && result?.shell) badge.textContent = result.shell;
  }

  // ── New terminal session ──────────────────────────────────────
  async function newSession() {
    if (!term) return;
    term.writeln('\r\n\x1b[90m[New terminal session]\x1b[0m\r\n');
    await window.electronAPI?.ptyKill?.();
    window.electronAPI?.offPtyData?.();
    window.electronAPI?.offPtyExit?.();
    window.electronAPI?.onPtyData?.((data) => term.write(data));
    window.electronAPI?.onPtyExit?.((code) => {
      term.writeln(`\r\n\x1b[33m[Exited ${code ?? 0}]\x1b[0m`);
      ptyReady = false;
    });
    await startPty();
    focus();
  }

  // ── Search in terminal output ─────────────────────────────────
  let _searchVisible = false;
  let _searchEl      = null;

  function toggleSearch() {
    if (!searchAddon) return;
    const container = document.getElementById('terminal-xterm');
    if (!container) return;

    if (_searchVisible) {
      _searchEl?.remove();
      _searchEl = null;
      _searchVisible = false;
      term?.focus();
      return;
    }

    _searchVisible = true;
    _searchEl = document.createElement('div');
    _searchEl.className = 'term-search-bar';
    _searchEl.innerHTML = `
      <input class="term-search-input" placeholder="Search terminal…" autocomplete="off" spellcheck="false"/>
      <button class="term-search-btn" id="tsb-prev" title="Previous (Shift+F3)">↑</button>
      <button class="term-search-btn" id="tsb-next" title="Next (F3)">↓</button>
      <button class="term-search-btn" id="tsb-close" title="Close">×</button>`;
    container.appendChild(_searchEl);

    const inp  = _searchEl.querySelector('input');
    const prev = _searchEl.querySelector('#tsb-prev');
    const next = _searchEl.querySelector('#tsb-next');
    const cls  = _searchEl.querySelector('#tsb-close');

    inp.focus();
    inp.addEventListener('input',   (e) => searchAddon.findNext(e.target.value, { caseSensitive: false, regex: false, wholeWord: false, incremental: true }));
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); searchAddon.findNext(inp.value);  }
      if (e.key === 'Escape') { e.preventDefault(); toggleSearch(); }
    });
    prev?.addEventListener('click', () => searchAddon.findPrevious(inp.value));
    next?.addEventListener('click', () => searchAddon.findNext(inp.value));
    cls?.addEventListener('click',  () => toggleSearch());
  }

  // ── Public helpers ────────────────────────────────────────────
  function fit()         { fitAddon?.fit(); }
  function focus()       { term?.focus(); }
  function fitAndFocus() { requestAnimationFrame(() => { fitAddon?.fit(); term?.focus(); }); }
  function clear()       { term?.clear(); }
  function setCwd(dir)   { window.electronAPI?.terminalSetCwd?.(dir); }

  // ── Keyboard shortcuts ────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    // Ctrl+` — toggle panel (delegated to BottomPanel)
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.code === 'Backquote') {
      e.preventDefault();
      window.BottomPanel?.toggle?.('terminal');
    }
    // Ctrl+F when terminal pane is active — search in terminal output
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'f') {
      const pane = document.getElementById('bp-pane-terminal');
      if (pane?.classList.contains('bp-content-active') && window.BottomPanel?.visible) {
        e.preventDefault();
        toggleSearch();
      }
    }
  });

  document.addEventListener('monaco-ready', () => {
    window.editor?.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backquote,
      () => window.BottomPanel?.toggle?.('terminal')
    );
  });

  return { init, newSession, fit, focus, fitAndFocus, clear, setCwd };
})();

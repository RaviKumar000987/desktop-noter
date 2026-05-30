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

    // ── Re-focus xterm on any click inside the terminal pane ─────
    // xterm renders into a canvas + hidden textarea.  Clicks on the
    // surrounding container do NOT transfer focus automatically.
    // We intercept mousedown and immediately focus before any other
    // handler (e.g. Monaco's global mousedown) can steal it back.
    const _termPane = document.getElementById('bp-pane-terminal');
    _termPane?.addEventListener('mousedown', (e) => {
      if (e.target.closest('.term-search-bar, .bp-icon-btn, #bp-tabbar, .bp-tab')) return;
      // Prevent the browser's native focus-move behavior for ALL clicks inside
      // the terminal pane.  Without this, clicking anywhere in the pane focuses
      // the nearest focusable ancestor, which triggers Monaco's focus handlers
      // and steals keyboard input away from xterm.
      //
      // xterm renders on a <canvas> and manages its own selection via JavaScript
      // (mousedown→mousemove→mouseup).  Canvas elements have no native text
      // selection, so preventDefault does NOT break xterm's selection logic —
      // xterm's own mousedown handler still fires and handles selection normally.
      e.preventDefault();
      term?.focus();
    });

    // ── Terminal right-click context menu ─────────────────────────
    _termPane?.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const hasSelection = term?.hasSelection?.() ?? false;
      const items = [
        {
          icon: '⎘', label: 'Copy',
          disabled: !hasSelection,
          action: () => {
            const sel = term?.getSelection?.() ?? '';
            if (sel) navigator.clipboard.writeText(sel);
          },
        },
        {
          icon: '⎘', label: 'Paste',
          action: async () => {
            const text = await navigator.clipboard.readText().catch(() => '');
            if (text) window.electronAPI?.ptyWrite?.(text);
          },
        },
        { separator: true },
        {
          icon: '☰', label: 'Select All',
          action: () => term?.selectAll?.(),
        },
        {
          icon: '⊗', label: 'Clear Terminal',
          action: () => term?.clear?.(),
        },
        { separator: true },
        {
          icon: '+', label: 'New Terminal Session',
          action: () => newSession(),
        },
        {
          icon: '🔍', label: 'Search in Terminal',
          action: () => toggleSearch(),
        },
        { separator: true },
        {
          icon: '⎘', label: 'Copy Terminal Path',
          action: async () => {
            const cwd = await window.electronAPI?.terminalGetCwd?.().catch(() => '') ?? '';
            if (cwd) { navigator.clipboard.writeText(cwd); }
          },
        },
      ];

      // Use the app-wide ContextMenu if available, otherwise build our own
      if (typeof ContextMenu !== 'undefined') {
        ContextMenu.show(items, e.clientX, e.clientY);
      } else {
        _showTermContextMenu(items, e.clientX, e.clientY);
      }

      // Restore terminal focus after menu closes (short delay so menu renders first)
      setTimeout(() => term?.focus(), 60);
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

  // ── Live settings.json options ────────────────────────────────
  // SettingsJSON dispatches this event when terminal.* keys change
  window.addEventListener('noter:terminal-options', (e) => {
    if (!term) return;
    const opts = e.detail || {};
    for (const [key, val] of Object.entries(opts)) {
      try { term.options[key] = val; } catch {}
    }
    fitAddon?.fit();
  });

  // ── Fallback terminal context menu ───────────────────────────
  // Used when the global ContextMenu singleton (context-menu.js) is not
  // available.  Shares the same .ctx-menu CSS class so it looks identical.
  let _termMenuEl = null;

  function _showTermContextMenu(items, x, y) {
    _hideTermMenu();
    _termMenuEl = document.createElement('div');
    _termMenuEl.className = 'ctx-menu';
    _termMenuEl.style.cssText = `position:fixed;z-index:10000;left:${x}px;top:${y}px;`;

    for (const item of items) {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'ctx-sep';
        _termMenuEl.appendChild(sep);
        continue;
      }
      const row = document.createElement('div');
      row.className = 'ctx-item' + (item.disabled ? ' ctx-disabled' : '');
      row.innerHTML = `<span class="ctx-icon">${item.icon || ''}</span><span class="ctx-label">${item.label}</span>`;
      if (!item.disabled && item.action) {
        row.addEventListener('mousedown', (e) => {
          e.preventDefault();
          _hideTermMenu();
          item.action();
        });
      }
      _termMenuEl.appendChild(row);
    }

    document.body.appendChild(_termMenuEl);

    // Auto-flip if near right/bottom edge
    requestAnimationFrame(() => {
      if (!_termMenuEl) return;
      const rect = _termMenuEl.getBoundingClientRect();
      if (rect.right  > window.innerWidth)  _termMenuEl.style.left = (x - rect.width)  + 'px';
      if (rect.bottom > window.innerHeight) _termMenuEl.style.top  = (y - rect.height) + 'px';
    });

    const _close = (e) => {
      if (_termMenuEl && !_termMenuEl.contains(e.target)) _hideTermMenu();
    };
    document.addEventListener('mousedown', _close, { once: true });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') _hideTermMenu(); }, { once: true });
  }

  function _hideTermMenu() {
    _termMenuEl?.remove();
    _termMenuEl = null;
  }

  function show() {
    const pane = document.getElementById('bp-pane-terminal');
    if (pane) pane.style.display = '';
    if (!initialized) init();
    fitAndFocus();
  }

  function hide() {
    const pane = document.getElementById('bp-pane-terminal');
    if (pane) pane.style.display = 'none';
  }

  return { init, show, hide, newSession, fit, focus, fitAndFocus, clear, setCwd, toggleSearch };
})();

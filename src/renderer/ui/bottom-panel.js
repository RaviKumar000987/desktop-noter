// ═══════════════════════════════════════════════════════════════
//  BOTTOM PANEL — VS Code-style tabbed panel
//  Tabs: Terminal · Problems · Output · Debug Console
//
//  Public API:
//    BottomPanel.show(tab?)          — open panel, optionally switch tab
//    BottomPanel.hide()              — close panel
//    BottomPanel.toggle(tab?)        — open/close or switch tab
//    BottomPanel.activateTab(tab)    — switch to tab without toggling
//    BottomPanel.outputAppend(ch, text, level)  — write to Output channel
//    BottomPanel.outputAppendLine(ch, text, level)
//    BottomPanel.logToDebug(type, text)         — write to Debug Console
// ═══════════════════════════════════════════════════════════════
'use strict';

window.BottomPanel = (() => {

  let _visible    = false;
  let _activeTab  = 'terminal';

  // ── Visibility ─────────────────────────────────────────────────
  function show(tab) {
    _visible = true;
    document.getElementById('bottom-panel')?.classList.add('bp-visible');
    if (tab && tab !== _activeTab) {
      _setActiveTab(tab);
    } else {
      _onTabActivated(_activeTab);
    }
  }

  function hide() {
    _visible = false;
    document.getElementById('bottom-panel')?.classList.remove('bp-visible');
    window.editor?.focus();
  }

  function toggle(tab) {
    if (_visible) {
      if (!tab || tab === _activeTab) { hide(); return; }
      // Already visible but different tab — switch
      _setActiveTab(tab);
    } else {
      show(tab || _activeTab);
    }
  }

  function activateTab(tab) {
    if (!_visible) show(tab);
    else _setActiveTab(tab);
  }

  // ── Tab switching ───────────────────────────────────────────────
  function _setActiveTab(tab) {
    _activeTab = tab;

    document.querySelectorAll('#bp-tabs .bp-tab').forEach(btn => {
      btn.classList.toggle('bp-tab-active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('#bottom-panel .bp-content').forEach(pane => {
      pane.classList.toggle('bp-content-active', pane.id === `bp-pane-${tab}`);
    });

    _onTabActivated(tab);
  }

  function _onTabActivated(tab) {
    // Context-specific controls in tabbar
    const shellBadge  = document.getElementById('tp-shell-name');
    const newTermBtn  = document.getElementById('terminal-new-btn');
    const channelSel  = document.getElementById('bp-output-channel');

    if (shellBadge) shellBadge.style.display  = tab === 'terminal' ? '' : 'none';
    if (newTermBtn) newTermBtn.style.display   = tab === 'terminal' ? '' : 'none';
    if (channelSel) channelSel.style.display   = tab === 'output'   ? '' : 'none';

    if (tab === 'terminal') {
      // Init terminal if first open, otherwise just fit + focus
      if (!window._terminalInitialized) {
        window._terminalInitialized = true;
        setTimeout(() => window.TerminalPanel?.init?.(), 30);
      } else {
        window.TerminalPanel?.fitAndFocus?.();
      }
    } else if (tab === 'problems') {
      _renderProblems();
    } else if (tab === 'output') {
      _renderOutput();
    } else if (tab === 'debug') {
      setTimeout(() => document.getElementById('bp-debug-input')?.focus(), 60);
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  PROBLEMS TAB
  // ══════════════════════════════════════════════════════════════
  let _problemsFilter = 'all';
  let _problemsSearch = '';

  function _collectDiags() {
    if (typeof monaco === 'undefined') return [];
    const all = [];
    for (const model of monaco.editor.getModels()) {
      const markers = monaco.editor.getModelMarkers({ resource: model.uri });
      for (const m of markers) {
        const raw = m.source === 'TypeScript' || m.source === 'ts' ? m.source : (m.source || 'lsp');
        const fp  = m.resource?.fsPath || m.resource?.path || model.uri.toString().replace(/^file:\/\/\//, '');
        all.push({
          uri:      model.uri.toString(),
          filePath: fp,
          fileName: fp.split(/[\\/]/).pop() || fp,
          severity: m.severity,
          message:  m.message,
          line:     m.startLineNumber,
          col:      m.startColumn,
          source:   raw,
          code:     m.code?.value ?? m.code ?? '',
        });
      }
    }
    return all.sort((a, b) => b.severity - a.severity || a.filePath.localeCompare(b.filePath));
  }

  function _renderProblems() {
    const listEl   = document.getElementById('bp-problems-list');
    const footerEl = document.getElementById('bp-problems-footer');
    if (!listEl) return;

    let diags = _collectDiags();

    // Apply filter
    if (_problemsFilter === 'error')   diags = diags.filter(d => d.severity === 8);
    if (_problemsFilter === 'warning') diags = diags.filter(d => d.severity === 4);
    if (_problemsFilter === 'info')    diags = diags.filter(d => d.severity <= 2);
    if (_problemsSearch) {
      const q = _problemsSearch.toLowerCase();
      diags = diags.filter(d =>
        d.message.toLowerCase().includes(q) || d.fileName.toLowerCase().includes(q)
      );
    }

    const all = _collectDiags();
    const errN  = all.filter(d => d.severity === 8).length;
    const warnN = all.filter(d => d.severity === 4).length;
    const infoN = all.filter(d => d.severity <= 2).length;

    if (!diags.length) {
      listEl.innerHTML = `<div class="bp-diag-empty">${
        all.length ? 'No problems match the current filter.' : '✓ No problems detected.'
      }</div>`;
    } else {
      const groups = new Map();
      for (const d of diags) {
        if (!groups.has(d.uri)) groups.set(d.uri, []);
        groups.get(d.uri).push(d);
      }
      listEl.innerHTML = [...groups.entries()].map(([uri, items]) => {
        const first = items[0];
        const fe = items.filter(d => d.severity === 8).length;
        const fw = items.filter(d => d.severity === 4).length;
        return `<div class="bp-diag-group">
          <div class="bp-diag-file">
            <span class="bp-diag-fname">${_esc(first.fileName)}</span>
            <span class="bp-diag-fpath">${_esc(first.filePath)}</span>
            <span class="bp-diag-fcounts">
              ${fe ? `<span class="dp-error">✕ ${fe}</span>` : ''}
              ${fw ? `<span class="dp-warn">⚠ ${fw}</span>` : ''}
            </span>
          </div>
          ${items.map(d => `
            <div class="bp-diag-row" data-uri="${_esc(d.uri)}" data-line="${d.line}" data-col="${d.col}" title="${_esc(d.message)}">
              <span class="${_sevCls(d.severity)} bp-diag-icon">${_sevIcon(d.severity)}</span>
              <span class="bp-diag-msg">${_esc(d.message)}</span>
              <span class="bp-diag-meta">
                ${d.source ? `<span class="bp-diag-src">${_esc(d.source)}</span>` : ''}
                ${d.code   ? `<span class="bp-diag-code">${_esc(String(d.code))}</span>` : ''}
                <span class="bp-diag-loc">Ln ${d.line}, Col ${d.col}</span>
              </span>
            </div>`).join('')}
        </div>`;
      }).join('');
    }

    if (footerEl) {
      footerEl.innerHTML = `
        <span class="${errN  ? 'dp-error'  : 'bp-diag-muted'}">✕ ${errN} Error${errN !== 1 ? 's' : ''}</span>
        <span class="${warnN ? 'dp-warn'   : 'bp-diag-muted'}">⚠ ${warnN} Warning${warnN !== 1 ? 's' : ''}</span>
        <span class="${infoN ? 'dp-info'   : 'bp-diag-muted'}">ℹ ${infoN} Info</span>`;
    }
    _updateProblemsBadge(errN, warnN);
  }

  function _updateProblemsBadge(errN, warnN) {
    errN  = errN  ?? _collectDiags().filter(d => d.severity === 8).length;
    warnN = warnN ?? _collectDiags().filter(d => d.severity === 4).length;
    const badge = document.getElementById('bp-problems-count');
    if (!badge) return;
    const total = errN + warnN;
    badge.textContent    = total > 0 ? String(total) : '';
    badge.style.display  = total > 0 ? '' : 'none';
    badge.className      = `bp-tab-badge ${errN > 0 ? 'bp-badge-error' : 'bp-badge-warn'}`;
  }

  function _navigateToDiag(uri, line, col) {
    if (typeof monaco === 'undefined' || !window.editor) return;
    const model = monaco.editor.getModels().find(m => m.uri.toString() === uri);
    if (!model) return;
    const tabs = window.TabManager?.getAll?.() || window.TabManager?.tabs || [];
    const tab  = tabs.find(t => t.model === model);
    if (tab) window.TabManager?.activate?.(tab.id);
    const pos = { lineNumber: line, column: col };
    window.editor.setPosition(pos);
    window.editor.revealPositionInCenter(pos);
    window.editor.focus();
  }

  function _sevCls(s)  { return s >= 8 ? 'dp-error' : s >= 4 ? 'dp-warn' : s >= 2 ? 'dp-info' : 'dp-hint'; }
  function _sevIcon(s) { return s >= 8 ? '✕' : s >= 4 ? '⚠' : s >= 2 ? 'ℹ' : '·'; }
  function _esc(s)     { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // ══════════════════════════════════════════════════════════════
  //  OUTPUT TAB — multi-channel log viewer
  // ══════════════════════════════════════════════════════════════
  const _outputChannels  = new Map(); // name → { lines: [] }
  let   _activeChannel   = 'noter';

  function _ensureChannel(name) {
    if (!_outputChannels.has(name)) {
      _outputChannels.set(name, { lines: [], maxLines: 3000 });
      const sel = document.getElementById('bp-output-channel');
      if (sel && !sel.querySelector(`option[value="${CSS.escape(name)}"]`)) {
        const opt = document.createElement('option');
        opt.value = opt.textContent = name;
        sel.appendChild(opt);
      }
    }
    return _outputChannels.get(name);
  }

  function outputAppend(channelName, text, level = 'log') {
    const ch  = _ensureChannel(channelName);
    const ts  = new Date().toLocaleTimeString('en-US', { hour12: false });
    const entry = { text: `[${ts}] ${text}`, level };
    ch.lines.push(entry);
    if (ch.lines.length > ch.maxLines) ch.lines.shift();

    if (_visible && _activeTab === 'output' && _activeChannel === channelName) {
      _appendOutputEntry(entry);
    }
  }

  function outputAppendLine(channelName, text, level = 'log') {
    outputAppend(channelName, text, level);
  }

  function _appendOutputEntry(entry) {
    const logEl = document.getElementById('bp-output-log');
    if (!logEl) return;
    const d = document.createElement('div');
    d.className = `bp-out-line bp-out-${entry.level}`;
    d.textContent = entry.text;
    logEl.appendChild(d);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function _renderOutput() {
    const logEl = document.getElementById('bp-output-log');
    if (!logEl) return;
    logEl.innerHTML = '';
    const ch = _outputChannels.get(_activeChannel);
    if (!ch || !ch.lines.length) {
      logEl.innerHTML = '<div class="bp-out-empty">No output in this channel.</div>';
      return;
    }
    const frag = document.createDocumentFragment();
    for (const entry of ch.lines) {
      const d = document.createElement('div');
      d.className = `bp-out-line bp-out-${entry.level}`;
      d.textContent = entry.text;
      frag.appendChild(d);
    }
    logEl.appendChild(frag);
    logEl.scrollTop = logEl.scrollHeight;
  }

  // ══════════════════════════════════════════════════════════════
  //  DEBUG CONSOLE — interactive JS eval + console capture
  // ══════════════════════════════════════════════════════════════
  const _evalHistory = [];
  let   _historyIdx  = -1;

  function logToDebug(type, ...parts) {
    const text = parts.map(p => typeof p === 'string' ? p : _prettyVal(p)).join(' ');
    const logEl = document.getElementById('bp-debug-log');
    if (!logEl) return;
    const d = document.createElement('div');
    d.className = `bp-debug-entry bp-debug-${type}`;
    if (type === 'input') {
      d.innerHTML = `<span class="bp-dbg-prompt">&gt;</span><span class="bp-dbg-expr">${_esc(text)}</span>`;
    } else if (type === 'result') {
      d.innerHTML = `<span class="bp-dbg-result">&lt; ${_esc(text)}</span>`;
    } else {
      d.innerHTML = `<span class="bp-dbg-${type}">${_esc(text)}</span>`;
    }
    logEl.appendChild(d);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function _prettyVal(v) {
    if (v === null)      return 'null';
    if (v === undefined) return 'undefined';
    if (typeof v === 'function') return `[Function: ${v.name || 'anonymous'}]`;
    if (typeof v === 'object') {
      try { return JSON.stringify(v, null, 2); } catch { return String(v); }
    }
    return String(v);
  }

  function _evalExpr(expr) {
    if (!expr.trim()) return;
    _evalHistory.unshift(expr);
    if (_evalHistory.length > 200) _evalHistory.pop();
    _historyIdx = -1;
    logToDebug('input', expr);
    try {
      const result = (0, eval)(expr); // eslint-disable-line no-eval
      logToDebug('result', result);
    } catch (err) {
      logToDebug('error', err.message || String(err));
    }
  }

  // Intercept console methods → route to Output + Debug Console
  function _interceptConsole() {
    const orig = {};
    ['log', 'warn', 'error', 'info', 'debug'].forEach(m => {
      orig[m] = console[m].bind(console);
      console[m] = (...args) => {
        orig[m](...args);
        const level = m === 'error' ? 'error' : m === 'warn' ? 'warn' : m === 'info' ? 'info' : 'log';
        const text  = args.map(a => typeof a === 'string' ? a : _prettyVal(a)).join(' ');
        outputAppend('noter', text, level);
        if (_visible && _activeTab === 'debug') logToDebug(level, text);
      };
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  RESIZE DRAG
  // ══════════════════════════════════════════════════════════════
  function _initResize() {
    let dragging = false, startY = 0, startH = 0;
    const panel = () => document.getElementById('bottom-panel');

    document.addEventListener('mousedown', (e) => {
      if (e.target?.id !== 'bp-resize-handle') return;
      dragging = true; startY = e.clientY; startH = panel()?.offsetHeight ?? 280;
      document.body.style.userSelect = 'none';
      document.body.style.cursor     = 'row-resize';
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const newH = Math.min(Math.max(startH - (e.clientY - startY), 100), 700);
      const p = panel(); if (p) p.style.height = newH + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = '';
      document.body.style.cursor     = '';
      if (_activeTab === 'terminal') window.TerminalPanel?.fit?.();
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  DOM WIRING
  // ══════════════════════════════════════════════════════════════
  function _initDom() {
    // Tab clicks
    document.getElementById('bp-tabs')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tab]');
      if (!btn) return;
      const tab = btn.dataset.tab;
      if (_visible && tab === _activeTab) hide();
      else show(tab);
    });

    // Close button
    document.getElementById('terminal-close-btn')?.addEventListener('click', hide);

    // Clear button — context-aware per tab
    document.getElementById('terminal-clear-btn')?.addEventListener('click', () => {
      if (_activeTab === 'terminal') {
        window.TerminalPanel?.clear?.();
      } else if (_activeTab === 'problems') {
        // Re-render (there's no "clear" for diagnostics — just refresh)
        _renderProblems();
      } else if (_activeTab === 'output') {
        const ch = _outputChannels.get(_activeChannel);
        if (ch) ch.lines = [];
        const logEl = document.getElementById('bp-output-log');
        if (logEl) logEl.innerHTML = '';
      } else if (_activeTab === 'debug') {
        const logEl = document.getElementById('bp-debug-log');
        if (logEl) logEl.innerHTML = '';
      }
    });

    // Output channel dropdown
    document.getElementById('bp-output-channel')?.addEventListener('change', (e) => {
      _activeChannel = e.target.value;
      _renderOutput();
    });

    // Problems filter buttons
    document.getElementById('bp-problems-toolbar')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      _problemsFilter = btn.dataset.filter;
      document.querySelectorAll('#bp-problems-toolbar [data-filter]').forEach(b =>
        b.classList.toggle('dp-filter-active', b === btn));
      _renderProblems();
    });

    // Problems search
    document.getElementById('bp-problems-search')?.addEventListener('input', (e) => {
      _problemsSearch = e.target.value;
      _renderProblems();
    });

    // Click on problem row → navigate editor
    document.getElementById('bp-problems-list')?.addEventListener('click', (e) => {
      const row = e.target.closest('[data-uri]');
      if (!row) return;
      _navigateToDiag(row.dataset.uri, +row.dataset.line, +row.dataset.col);
    });

    // Debug Console input
    const dbgInput = document.getElementById('bp-debug-input');
    if (dbgInput) {
      dbgInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const expr = dbgInput.value;
          dbgInput.value = '';
          _evalExpr(expr);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (_historyIdx < _evalHistory.length - 1) {
            dbgInput.value = _evalHistory[++_historyIdx];
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (_historyIdx > 0) { dbgInput.value = _evalHistory[--_historyIdx]; }
          else { _historyIdx = -1; dbgInput.value = ''; }
        }
      });
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  KEYBOARD SHORTCUTS
  // ══════════════════════════════════════════════════════════════
  function _initKeys() {
    document.addEventListener('keydown', (e) => {
      if (!e.ctrlKey) return;

      // Ctrl+` — toggle terminal
      if (!e.shiftKey && !e.altKey && e.code === 'Backquote') {
        e.preventDefault();
        toggle('terminal');
      }
      // Ctrl+Shift+M — problems
      if (e.shiftKey && !e.altKey && e.key === 'M') {
        e.preventDefault();
        toggle('problems');
      }
      // Ctrl+Shift+U — output
      if (e.shiftKey && !e.altKey && e.key === 'U') {
        e.preventDefault();
        toggle('output');
      }
      // Ctrl+Shift+Y — debug console
      if (e.shiftKey && !e.altKey && e.key === 'Y') {
        e.preventDefault();
        toggle('debug');
      }
    });

    // Monaco editor shortcut (Ctrl+`)
    document.addEventListener('monaco-ready', () => {
      if (typeof monaco === 'undefined') return;
      window.editor?.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backquote,
        () => toggle('terminal')
      );
      // Auto-refresh Problems when markers change
      monaco.editor.onDidChangeMarkers(() => {
        _updateProblemsBadge();
        if (_visible && _activeTab === 'problems') _renderProblems();
      });
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  COMMANDS
  // ══════════════════════════════════════════════════════════════
  function _registerCommands() {
    window.NoterCommands?.register({
      id:          'workbench.action.terminal.toggleTerminal',
      title:       'Toggle Terminal',
      category:    'Terminal',
      description: 'Open or close the integrated terminal (Ctrl+`)',
      aliases:     ['terminal', 'bash', 'shell', 'console', 'zsh'],
      handler:     () => toggle('terminal'),
    });
    window.NoterCommands?.register({
      id:          'workbench.actions.view.problems',
      title:       'Toggle Problems Panel',
      category:    'View',
      description: 'Show/hide the Problems tab (Ctrl+Shift+M)',
      aliases:     ['problems', 'errors', 'diagnostics', 'warnings'],
      handler:     () => toggle('problems'),
    });
    window.NoterCommands?.register({
      id:          'workbench.action.output.toggleOutput',
      title:       'Toggle Output Panel',
      category:    'View',
      description: 'Show/hide the Output channel log (Ctrl+Shift+U)',
      aliases:     ['output', 'logs', 'output panel', 'language server log'],
      handler:     () => toggle('output'),
    });
    window.NoterCommands?.register({
      id:          'workbench.action.debug.toggleDebugConsole',
      title:       'Toggle Debug Console',
      category:    'View',
      description: 'Show/hide the interactive Debug Console (Ctrl+Shift+Y)',
      aliases:     ['debug console', 'repl', 'debug', 'evaluate'],
      handler:     () => toggle('debug'),
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  LSP OUTPUT ROUTING — log LSP server events to Output tab
  // ══════════════════════════════════════════════════════════════
  function _hookLspOutput() {
    // Log server status changes
    document.addEventListener('lsp:status-changed', (e) => {
      const statuses = e.detail || [];
      for (const s of statuses) {
        const name = s.name || s.id;
        if (s.state === 'running')   outputAppend('Language Server', `${name} started`, 'info');
        else if (s.state === 'error') outputAppend('Language Server', `${name} error: ${s.error || ''}`, 'error');
        else if (s.state === 'stopped') outputAppend('Language Server', `${name} stopped`, 'log');
      }
    });

    // Route LSP log/window messages to channel
    document.addEventListener('lsp:message', (e) => {
      const { server, message } = e.detail || {};
      if (message?.method === 'window/logMessage') {
        const level = [undefined,'error','warn','info','log'][message.params?.type] || 'log';
        outputAppend(server || 'LSP', message.params?.message || '', level);
      }
      if (message?.method === 'window/showMessage') {
        outputAppend(server || 'LSP', `⚡ ${message.params?.message || ''}`, 'info');
      }
    });

    // Diagnostics update → refresh badge and Problems tab
    document.addEventListener('lsp:diagnostics-updated', () => {
      _updateProblemsBadge();
      if (_visible && _activeTab === 'problems') _renderProblems();
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  BOOT
  // ══════════════════════════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', () => {
    _initDom();
    _initResize();
    _initKeys();
    _registerCommands();
    _interceptConsole();
    _hookLspOutput();

    // Seed the Output tab with an opener message
    outputAppend('noter', 'Noter ready — Language Intelligence Platform active', 'info');

    // Remove the old DiagnosticsPanel floating toggle so it doesn't conflict
    // (DiagnosticsPanel will still maintain its own badge for legacy keybinding)
  });

  return {
    show, hide, toggle, activateTab,
    outputAppend, outputAppendLine,
    logToDebug,
    get visible()   { return _visible; },
    get activeTab() { return _activeTab; },
  };
})();

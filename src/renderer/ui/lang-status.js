// ═══════════════════════════════════════════════════════════════
//  LANGUAGE SERVER MANAGER — src/renderer/ui/lang-status.js
//  Status bar indicators + manager panel for LSP servers.
//  Shows: TS ✓  Python ✓  clangd ✗  and install prompts.
// ═══════════════════════════════════════════════════════════════
'use strict';

window.LangStatus = (() => {
  let _panel      = null;
  let _statusEl   = null;
  let _statuses   = {};

  const ICONS = {
    typescript: { name: 'TypeScript',  icon: 'TS',  lang: 'JS/TS'    },
    pyright:    { name: 'Pyright',     icon: 'Py',  lang: 'Python'   },
    clangd:     { name: 'clangd',      icon: 'C++', lang: 'C/C++'    },
    jdtls:      { name: 'JDT LS',     icon: 'Jv',  lang: 'Java'     },
  };

  const STATE_STYLE = {
    builtin:   { cls: 'ls-ok',      dot: '●', tip: 'Built-in (always available)' },
    running:   { cls: 'ls-ok',      dot: '●', tip: 'Running'                     },
    starting:  { cls: 'ls-warn',    dot: '◌', tip: 'Starting…'                   },
    stopped:   { cls: 'ls-off',     dot: '○', tip: 'Stopped'                     },
    not_found: { cls: 'ls-missing', dot: '✕', tip: 'Not installed'               },
    error:     { cls: 'ls-error',   dot: '!', tip: 'Error'                       },
  };

  // ── Status bar strip ──────────────────────────────────────────
  function _buildStatusBar() {
    if (_statusEl) return;
    _statusEl = document.createElement('span');
    _statusEl.id = 'ls-statusbar';
    _statusEl.className = 'ls-statusbar';
    _statusEl.title = 'Language Servers — click to manage';
    _statusEl.addEventListener('click', togglePanel);
    document.querySelector('.status-left')?.appendChild(_statusEl);
  }

  function _updateStatusBar() {
    if (!_statusEl) return;
    const chips = Object.entries(_statuses).map(([id, s]) => {
      const info  = ICONS[id] || { icon: id.slice(0, 2).toUpperCase() };
      const style = STATE_STYLE[s.state] || STATE_STYLE.stopped;
      return `<span class="ls-chip ${style.cls}" title="${info.name}: ${style.tip}">
        ${info.icon}<span class="ls-dot">${style.dot}</span>
      </span>`;
    }).join('');
    _statusEl.innerHTML = chips || '<span class="ls-chip ls-off" title="No language servers">LSP</span>';
  }

  // ── Manager panel ─────────────────────────────────────────────
  function _buildPanel() {
    if (_panel) return;
    _panel = document.createElement('div');
    _panel.id = 'ls-panel';
    _panel.innerHTML = `
      <div class="ls-panel-header">
        <span class="ls-panel-title">Language Servers</span>
        <button class="ls-panel-close" id="ls-panel-close">✕</button>
      </div>
      <div id="ls-panel-body" class="ls-panel-body"></div>
      <div class="ls-panel-footer">
        <span class="ls-footer-note">Language servers provide IntelliSense, diagnostics &amp; refactoring.</span>
      </div>`;
    document.body.appendChild(_panel);
    _panel.querySelector('#ls-panel-close').addEventListener('click', hidePanel);
    _panel.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, server } = btn.dataset;
      if (action === 'start')   _startServer(server);
      if (action === 'stop')    _stopServer(server);
      if (action === 'restart') _restartServer(server);
      if (action === 'install') _showInstallHint(server);
    });
  }

  function _renderPanel() {
    const body = _panel?.querySelector('#ls-panel-body');
    if (!body) return;

    body.innerHTML = Object.entries(_statuses).map(([id, s]) => {
      const info  = ICONS[id] || { name: id, icon: id.slice(0,2).toUpperCase(), lang: id };
      const style = STATE_STYLE[s.state] || STATE_STYLE.stopped;
      const isBuiltin = s.state === 'builtin';
      const isRunning = s.state === 'running' || s.state === 'builtin';
      const isMissing = s.state === 'not_found';

      return `
        <div class="ls-server-row">
          <div class="ls-server-icon">${info.icon}</div>
          <div class="ls-server-info">
            <div class="ls-server-name">${info.name}</div>
            <div class="ls-server-lang">${info.lang}</div>
          </div>
          <div class="ls-server-state ${style.cls}">
            <span class="ls-state-dot">${style.dot}</span>
            <span class="ls-state-label">${s.state}</span>
          </div>
          <div class="ls-server-actions">
            ${isBuiltin ? '<span class="ls-builtin-tag">built-in</span>' : ''}
            ${isMissing ? `<button class="ls-btn ls-btn-install" data-action="install" data-server="${id}">Install</button>` : ''}
            ${!isBuiltin && !isMissing && !isRunning ? `<button class="ls-btn ls-btn-start" data-action="start" data-server="${id}">Start</button>` : ''}
            ${!isBuiltin && isRunning ? `
              <button class="ls-btn ls-btn-restart" data-action="restart" data-server="${id}" title="Restart">↻</button>
              <button class="ls-btn ls-btn-stop"    data-action="stop"    data-server="${id}" title="Stop">■</button>
            ` : ''}
          </div>
        </div>
        ${s.error ? `<div class="ls-server-error">${s.error}</div>` : ''}`;
    }).join('') || '<div class="ls-panel-empty">No language servers detected.</div>';
  }

  // ── Server control ────────────────────────────────────────────
  async function _startServer(id) {
    if (!window.electronAPI?.lspStart) return;
    const result = await window.electronAPI.lspStart(id);
    if (result.ok) await _refresh();
    else typeof toast === 'function' && toast(`Failed to start ${id}: ${result.error}`, 'error');
  }

  async function _stopServer(id) {
    await window.electronAPI?.lspStop?.(id);
    await _refresh();
  }

  async function _restartServer(id) {
    await _stopServer(id);
    setTimeout(() => _startServer(id), 600);
  }

  function _showInstallHint(id) {
    const hints = {
      pyright: 'Install Python support:\n  npm install -g pyright\n  OR: pip install python-lsp-server\n\nThen restart Noter.',
      clangd:  'Install clangd:\n  Windows: Install LLVM from https://releases.llvm.org/\n  macOS:   brew install llvm\n  Linux:   sudo apt install clangd\n\nThen restart Noter.',
      jdtls:   'Install Eclipse JDT Language Server:\n  See: https://github.com/eclipse-jdtls/eclipse.jdt.ls\n  Set JDTLS_HOME environment variable.\n\nThen restart Noter.',
    };
    alert(hints[id] || `Install ${id} and restart Noter.`);
  }

  // ── Refresh status from main process ─────────────────────────
  async function _refresh() {
    if (!window.electronAPI?.lspStatus) return;
    _statuses = await window.electronAPI.lspStatus().catch(() => ({}));
    _updateStatusBar();
    if (_panel?.classList.contains('ls-panel-visible')) _renderPanel();
  }

  // ── Show / hide panel ─────────────────────────────────────────
  function showPanel() {
    _buildPanel();
    _renderPanel();
    _panel.classList.add('ls-panel-visible');
  }

  function hidePanel() {
    _panel?.classList.remove('ls-panel-visible');
  }

  function togglePanel() {
    if (_panel?.classList.contains('ls-panel-visible')) hidePanel();
    else showPanel();
  }

  // ── Init ──────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    _buildStatusBar();
    _refresh();

    // Listen for server status changes pushed from main process
    window.electronAPI?.onLspServerStatus?.((s) => {
      if (_statuses[s.id]) _statuses[s.id] = { ..._statuses[s.id], ...s };
      _updateStatusBar();
      if (_panel?.classList.contains('ls-panel-visible')) _renderPanel();
    });

    // Also refresh when LspClient reports a change
    document.addEventListener('lsp:status-changed', _refresh);

    // Register command
    window.NoterCommands?.register({
      id:       'workbench.languageServers',
      title:    'Language Servers',
      category: 'Workspace',
      description: 'Open the language server manager',
      aliases:  ['lsp','language server','pyright','clangd'],
      handler:  togglePanel,
    });
  });

  return { showPanel, hidePanel, togglePanel, refresh: _refresh };
})();

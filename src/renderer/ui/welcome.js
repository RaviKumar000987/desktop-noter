// ═══════════════════════════════════════════════════════════════
//  WELCOME PAGE — welcome.js
//  First-run welcome · recent workspaces · tip toasts
// ═══════════════════════════════════════════════════════════════

window.NoterWelcome = (() => {
  const TIPS = [
    { key: 'Ctrl+P',        desc: 'Quick Open — jump to any file in the workspace instantly' },
    { key: 'Ctrl+Shift+P',  desc: 'Command Palette — access every action by typing its name' },
    { key: 'Ctrl+Shift+F',  desc: 'Global Search — search for text across all files at once' },
    { key: 'Alt+Z',         desc: 'Zen Mode — hide all UI chrome for distraction-free coding' },
    { key: 'Ctrl+D',        desc: 'Duplicate the current line with a single key' },
    { key: 'Ctrl+/',        desc: 'Toggle line comment in any programming language' },
    { key: 'Ctrl+G',        desc: 'Go to Line — jump to any line number instantly' },
    { key: 'F12',           desc: 'Go to Definition — jump to where a symbol is defined' },
    { key: 'Ctrl+Shift+L',  desc: 'Select all occurrences of the current selection' },
    { key: 'Alt+Shift+F',   desc: 'Format Document — auto-format the entire file' },
    { key: 'Ctrl+Tab',      desc: 'Cycle forward through open editor tabs' },
    { key: 'Ctrl+\\',       desc: 'Split Editor — open two files side by side' },
    { key: 'Ctrl+J',        desc: 'Toggle the integrated terminal without leaving the editor' },
    { key: 'Ctrl+B',        desc: 'Toggle the file explorer sidebar' },
    { key: 'Ctrl+K Ctrl+S', desc: 'Open the full Keyboard Shortcuts editor' },
    { key: 'Alt+Click',     desc: 'Add a cursor — edit multiple places at the same time' },
    { key: 'Ctrl+Alt+↑/↓',  desc: 'Add cursors above or below the current line' },
    { key: 'Ctrl+.',        desc: 'Quick Fix — apply code fixes and refactors' },
    { key: 'F2',            desc: 'Rename Symbol — rename across the entire workspace' },
  ];

  let _tipIdx = 0;
  let _panel  = null;

  // ── Build panel ───────────────────────────────────────────────
  function _build() {
    if (_panel) return;
    _panel = document.createElement('div');
    _panel.id = 'welcome-overlay';
    _panel.innerHTML = `
      <div class="welcome-panel">

        <!-- Header -->
        <div class="welcome-hdr">
          <div class="welcome-logo-wrap">
            <span class="welcome-logo">N</span>
          </div>
          <div class="welcome-hdr-text">
            <div class="welcome-title">Welcome to Noter</div>
            <div class="welcome-subtitle">The developer's editor, reimagined</div>
          </div>
          <button class="welcome-close-btn" id="wlc-close" title="Close">✕</button>
        </div>

        <!-- Body -->
        <div class="welcome-body">

          <!-- Start -->
          <section class="wlc-section">
            <h3 class="wlc-section-title">Start</h3>
            <div class="wlc-actions">
              <button class="wlc-action" data-cmd="file.newFile">
                <span class="wlc-action-icon">📄</span>
                <span class="wlc-action-label">New File</span>
                <kbd>Ctrl+N</kbd>
              </button>
              <button class="wlc-action" data-cmd="file.openFile">
                <span class="wlc-action-icon">📂</span>
                <span class="wlc-action-label">Open File</span>
                <kbd>Ctrl+O</kbd>
              </button>
              <button class="wlc-action" data-cmd="file.openFolder">
                <span class="wlc-action-icon">🗂</span>
                <span class="wlc-action-label">Open Folder</span>
                <kbd>Ctrl+K Ctrl+O</kbd>
              </button>
            </div>
          </section>

          <!-- Recent -->
          <section class="wlc-section">
            <h3 class="wlc-section-title">Recent</h3>
            <div id="wlc-recent" class="wlc-recent">
              <span class="wlc-empty">Loading recent workspaces…</span>
            </div>
          </section>

          <!-- Learn -->
          <section class="wlc-section">
            <h3 class="wlc-section-title">Learn &amp; Configure</h3>
            <div class="wlc-learn-grid">
              <button class="wlc-learn-btn" data-cmd="workbench.keyboardShortcuts">
                ⌨ Keyboard Shortcuts
              </button>
              <button class="wlc-learn-btn" data-cmd="nav.commandPalette">
                ⌘ Command Palette
              </button>
              <button class="wlc-learn-btn" id="wlc-open-settings">
                ⚙ Settings
              </button>
              <button class="wlc-learn-btn" id="wlc-open-marketplace">
                🧩 Extensions
              </button>
            </div>
          </section>

          <!-- Tip -->
          <section class="wlc-section wlc-tip-section">
            <h3 class="wlc-section-title">💡 Did you know?</h3>
            <div id="wlc-tip" class="wlc-tip"></div>
            <div class="wlc-tip-nav">
              <button class="wlc-tip-arrow" id="wlc-prev-tip">‹</button>
              <span id="wlc-tip-counter" class="wlc-tip-counter"></span>
              <button class="wlc-tip-arrow" id="wlc-next-tip">›</button>
            </div>
          </section>

        </div><!-- /body -->

        <!-- Footer -->
        <div class="welcome-footer">
          <label class="wlc-show-toggle">
            <input type="checkbox" id="wlc-startup-check"/>
            Show welcome on startup
          </label>
          <span class="wlc-version">Noter v2.0</span>
        </div>

      </div>`;

    document.body.appendChild(_panel);
    _wireEvents();
    _loadRecent();
    _renderTip();

    // Set startup checkbox state
    const check = _panel.querySelector('#wlc-startup-check');
    check.checked = _shouldShow();
    check.addEventListener('change', e => {
      try { localStorage.setItem('noter.welcome.show', e.target.checked ? '1' : '0'); } catch {}
    });
  }

  function _wireEvents() {
    _panel.querySelector('#wlc-close').addEventListener('click', hide);
    _panel.addEventListener('click', e => { if (e.target === _panel) hide(); });

    _panel.querySelectorAll('[data-cmd]').forEach(btn => {
      btn.addEventListener('click', () => {
        hide();
        setTimeout(() => window.NoterCommands?.execute(btn.dataset.cmd), 60);
      });
    });

    _panel.querySelector('#wlc-open-settings')?.addEventListener('click', () => {
      hide(); setTimeout(() => window.SettingsUI?.open(), 60);
    });
    _panel.querySelector('#wlc-open-marketplace')?.addEventListener('click', () => {
      hide(); setTimeout(() => window.MarketplaceUI?.open?.() ||
        window.NoterCommands?.execute?.('view.extensions'), 60);
    });

    _panel.querySelector('#wlc-prev-tip')?.addEventListener('click', () => {
      _tipIdx = (_tipIdx - 1 + TIPS.length) % TIPS.length; _renderTip();
    });
    _panel.querySelector('#wlc-next-tip')?.addEventListener('click', () => {
      _tipIdx = (_tipIdx + 1) % TIPS.length; _renderTip();
    });
  }

  async function _loadRecent() {
    const container = _panel?.querySelector('#wlc-recent');
    if (!container) return;
    try {
      const list = await window.electronAPI?.getRecentWorkspaces?.() || [];
      if (!list.length) { container.innerHTML = '<span class="wlc-empty">No recent workspaces</span>'; return; }
      container.innerHTML = list.slice(0, 6).map(r => {
        const name = r.name || (r.path || r).split(/[/\\]/).pop();
        const path = r.path || r;
        return `<button class="wlc-recent-item" data-path="${path}" title="${path}">
          <span class="wlc-ri-name">${name}</span>
          <span class="wlc-ri-path">${path}</span>
        </button>`;
      }).join('');
      container.querySelectorAll('[data-path]').forEach(btn =>
        btn.addEventListener('click', () => {
          hide();
          window.electronAPI?.openWorkspace?.(btn.dataset.path);
        })
      );
    } catch { container.innerHTML = '<span class="wlc-empty">No recent workspaces</span>'; }
  }

  function _renderTip() {
    const tip = _panel?.querySelector('#wlc-tip');
    const ctr = _panel?.querySelector('#wlc-tip-counter');
    if (!tip) return;
    const t = TIPS[_tipIdx];
    tip.innerHTML = `<kbd class="wlc-kbd">${t.key}</kbd><span class="wlc-tip-desc"> — ${t.desc}</span>`;
    if (ctr) ctr.textContent = `${_tipIdx + 1} / ${TIPS.length}`;
  }

  // ── Floating tip toast ────────────────────────────────────────
  let _toastTimer = null;
  function showTipToast() {
    clearTimeout(_toastTimer);
    const t = TIPS[Math.floor(Math.random() * TIPS.length)];
    let el = document.getElementById('tip-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'tip-toast';
      document.body.appendChild(el);
    }
    el.className = 'tip-toast tip-toast-enter';
    el.innerHTML = `<span class="tip-toast-eyebrow">💡 Did you know?</span>
      <span class="tip-toast-body"><kbd>${t.key}</kbd> — ${t.desc}</span>`;
    // animate in
    requestAnimationFrame(() => el.classList.add('tip-toast-show'));
    _toastTimer = setTimeout(() => {
      el.classList.remove('tip-toast-show');
      setTimeout(() => el.classList.remove('tip-toast-enter'), 350);
    }, 5500);
  }

  // ── Open / Close / Init ───────────────────────────────────────
  function show() {
    _build();
    _panel.classList.add('welcome-visible');
    _tipIdx = 0; _renderTip();
    _loadRecent();
  }

  function hide() { _panel?.classList.remove('welcome-visible'); }

  function _shouldShow() {
    try { return localStorage.getItem('noter.welcome.show') !== '0'; } catch { return true; }
  }

  function init() {
    if (_shouldShow()) setTimeout(show, 500);

    // Tip toast every 5 launches
    try {
      const n = parseInt(localStorage.getItem('noter.launch.count') || '0') + 1;
      localStorage.setItem('noter.launch.count', String(n));
      if (n > 1 && n % 5 === 0) setTimeout(showTipToast, 4000);
    } catch {}
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.NoterCommands?.register({
      id: 'help.welcome',
      title: 'Welcome',
      category: 'Help',
      description: 'Open the welcome page',
      handler: show,
    });
  });

  return { show, hide, init, showTipToast };
})();

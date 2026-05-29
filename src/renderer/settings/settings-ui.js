// ═══════════════════════════════════════════════════════════════
//  SETTINGS UI — settings-ui.js
//  VS Code-inspired settings panel. Reads/writes via NoterSettings.
//  Deps: settings-manager.js (must load first)
// ═══════════════════════════════════════════════════════════════

const SettingsUI = (() => {
  let overlay     = null;
  let currentCat  = 'editor';
  let searchQuery = '';

  // ── Category definitions ──────────────────────────────────────
  const CATEGORIES = [
    { id: 'editor',     label: 'Editor',      icon: _svg('edit')   },
    { id: 'terminal',   label: 'Terminal',     icon: _svg('term')   },
    { id: 'appearance', label: 'Appearance',   icon: _svg('appear') },
    { id: 'profiles',   label: 'Profiles',     icon: _svg('prof')   },
    { id: 'extensions', label: 'Extensions',   icon: _svg('ext')    },
    { id: 'keyboard',   label: 'Keyboard',     icon: _svg('key')    },
    { id: 'files',      label: 'Files',        icon: _svg('file')   },
    { id: 'git',        label: 'Git',          icon: _svg('git')    },
  ];

  // ── Full settings schema ──────────────────────────────────────
  const SETTINGS = {
    editor: [
      { group: 'Font', items: [
        { key: 'editor.fontSize',      label: 'Font Size',       desc: 'Controls font size in pixels.',       type: 'number', def: 18, min: 8, max: 72 },
        { key: 'editor.fontFamily',    label: 'Font Family',     desc: 'Controls the font family.',            type: 'text',   def: 'Cascadia Code, Fira Code, Consolas' },
        { key: 'editor.lineHeight',    label: 'Line Height',     desc: 'Controls the line height.',            type: 'number', def: 1.5, min: 1, max: 4, step: 0.1 },
        { key: 'editor.letterSpacing', label: 'Letter Spacing',  desc: 'Controls letter spacing (px).',        type: 'number', def: 0, step: 0.1 },
        { key: 'editor.fontWeight',    label: 'Font Weight',     desc: 'Controls font weight.',                type: 'select', opts: ['normal','bold','100','200','300','400','500','600','700'], def: 'normal' },
      ]},
      { group: 'Cursor', items: [
        { key: 'editor.cursorStyle',    label: 'Cursor Style',    desc: 'Controls the cursor style.',          type: 'select', opts: ['line','block','underline','line-thin','block-outline','underline-thin'], def: 'line' },
        { key: 'editor.cursorBlinking', label: 'Cursor Blinking', desc: 'Controls the cursor animation.',      type: 'select', opts: ['blink','smooth','phase','expand','solid'], def: 'blink' },
        { key: 'editor.cursorWidth',    label: 'Cursor Width',    desc: 'Width when cursor style is line.',    type: 'number', def: 2, min: 1, max: 10 },
        { key: 'editor.smoothScrolling', label: 'Smooth Scrolling', desc: 'Animate scrolling.',               type: 'toggle', def: false },
        { key: 'editor.mouseWheelZoom', label: 'Mouse Wheel Zoom', desc: 'Zoom via Ctrl + scroll wheel.',      type: 'toggle', def: false },
      ]},
      { group: 'Editing', items: [
        { key: 'editor.wordWrap',           label: 'Word Wrap',                desc: 'Controls how lines are wrapped.',    type: 'select', opts: ['off','on','wordWrapColumn','bounded'], def: 'on' },
        { key: 'editor.tabSize',            label: 'Tab Size',                 desc: 'Spaces a tab is equal to.',         type: 'number', def: 4, min: 1, max: 16 },
        { key: 'editor.insertSpaces',       label: 'Insert Spaces',            desc: 'Insert spaces when pressing Tab.',  type: 'toggle', def: true },
        { key: 'editor.detectIndentation',  label: 'Detect Indentation',       desc: 'Auto-detect indentation.',          type: 'toggle', def: true },
        { key: 'editor.autoIndent',         label: 'Auto Indent',              desc: 'Automatically indent new lines.',   type: 'select', opts: ['none','keep','brackets','advanced','full'], def: 'full' },
        { key: 'editor.formatOnSave',       label: 'Format On Save',           desc: 'Format file on every save.',        type: 'toggle', def: false },
        { key: 'editor.formatOnPaste',      label: 'Format On Paste',          desc: 'Format pasted content.',            type: 'toggle', def: false },
        { key: 'editor.trimAutoWhitespace', label: 'Trim Auto Whitespace',     desc: 'Trim trailing whitespace.',         type: 'toggle', def: true },
        { key: 'editor.linkedEditing',      label: 'Linked Editing',           desc: 'Edit paired HTML tags together.',   type: 'toggle', def: true },
      ]},
      { group: 'Display', items: [
        { key: 'editor.lineNumbers',        label: 'Line Numbers',             desc: 'Display line numbers.',             type: 'select', opts: ['on','off','relative','interval'], def: 'on' },
        { key: 'editor.minimap.enabled',    label: 'Minimap',                  desc: 'Show the minimap.',                 type: 'toggle', def: true },
        { key: 'editor.renderWhitespace',   label: 'Render Whitespace',        desc: 'Visualize whitespace characters.',  type: 'select', opts: ['none','boundary','selection','trailing','all'], def: 'selection' },
        { key: 'editor.renderLineHighlight',label: 'Render Line Highlight',    desc: 'Highlight the current line.',       type: 'select', opts: ['none','gutter','line','all'], def: 'all' },
        { key: 'editor.bracketPairColorization.enabled', label: 'Bracket Pair Colorization', desc: 'Colorize matching brackets.', type: 'toggle', def: true },
        { key: 'editor.guides.bracketPairs', label: 'Bracket Pair Guides',    desc: 'Show bracket pair guides.',         type: 'toggle', def: true },
        { key: 'editor.stickyScroll.enabled', label: 'Sticky Scroll',         desc: 'Stick scope lines at top.',         type: 'toggle', def: false },
        { key: 'editor.occurrencesHighlight', label: 'Highlight Occurrences', desc: 'Highlight references on click.',    type: 'toggle', def: true },
        { key: 'editor.selectionHighlight',   label: 'Highlight Selection',   desc: 'Highlight matching text.',          type: 'toggle', def: true },
        { key: 'editor.codeLens',           label: 'Code Lens',               desc: 'Show inline reference counts.',     type: 'toggle', def: true },
      ]},
      { group: 'IntelliSense', items: [
        { key: 'editor.quickSuggestions',         label: 'Quick Suggestions',       desc: 'Enable inline suggestions while typing.',    type: 'toggle', def: true },
        { key: 'editor.parameterHints',           label: 'Parameter Hints',         desc: 'Show parameter hint popup.',                 type: 'toggle', def: true },
        { key: 'editor.autoClosingBrackets',      label: 'Auto Closing Brackets',   desc: 'Auto-close brackets on type.',               type: 'toggle', def: true },
        { key: 'editor.autoClosingQuotes',        label: 'Auto Closing Quotes',     desc: 'Auto-close quotes on type.',                 type: 'toggle', def: true },
        { key: 'editor.suggestOnTriggerCharacters', label: 'Suggest On Trigger',   desc: 'Trigger suggestions on . ( [ etc.',          type: 'toggle', def: true },
        { key: 'editor.inlineSuggest.enabled',    label: 'Inline Suggestions',      desc: 'Show ghost-text inline suggestions.',        type: 'toggle', def: true },
        { key: 'editor.wordBasedSuggestions',     label: 'Word Based Suggestions',  desc: 'Suggest based on words in file.',            type: 'select', opts: ['off','currentDocument','matchingDocuments','allDocuments'], def: 'currentDocument' },
        { key: 'editor.tabCompletion',            label: 'Tab Completion',          desc: 'Insert completions on Tab.',                 type: 'select', opts: ['on','off','onlySnippets'], def: 'off' },
      ]},
    ],

    terminal: [
      { group: 'Shell', items: [
        { key: 'terminal.shell',      label: 'Default Shell',   desc: 'Leave blank for system default.',     type: 'text',   def: '' },
        { key: 'terminal.fontSize',   label: 'Font Size',       desc: 'Terminal font size.',                 type: 'number', def: 13, min: 8, max: 36 },
        { key: 'terminal.fontFamily', label: 'Font Family',     desc: 'Terminal font family.',               type: 'text',   def: 'Cascadia Code, Fira Code, Consolas' },
        { key: 'terminal.lineHeight', label: 'Line Height',     desc: 'Terminal line height.',               type: 'number', def: 1.35, min: 1, max: 3, step: 0.05 },
      ]},
      { group: 'Behavior', items: [
        { key: 'terminal.cursorBlink',     label: 'Cursor Blink',      desc: 'Blink the terminal cursor.',    type: 'toggle', def: true },
        { key: 'terminal.cursorStyle',     label: 'Cursor Style',      desc: 'Terminal cursor shape.',        type: 'select', opts: ['block','underline','bar'], def: 'block' },
        { key: 'terminal.scrollback',      label: 'Scrollback Lines',  desc: 'Number of scrollback lines.',   type: 'number', def: 5000, min: 0 },
        { key: 'terminal.copyOnSelection', label: 'Copy On Selection', desc: 'Auto-copy selected terminal text.', type: 'toggle', def: false },
        { key: 'terminal.gpuAcceleration', label: 'GPU Acceleration',  desc: 'Use canvas-based rendering.',   type: 'select', opts: ['auto','on','off'], def: 'auto' },
      ]},
    ],

    appearance: [
      { group: 'Theme', items: [
        { key: 'appearance.colorTheme', label: 'Color Theme',     desc: 'Choose the color theme.',           type: 'select', opts: ['GitHub Dark','GitHub Dark Dimmed','VS Code Dark Modern'], def: 'GitHub Dark' },
        { key: 'appearance.iconTheme',  label: 'File Icon Theme', desc: 'File icon style.',                  type: 'select', opts: ['Default','None'], def: 'Default' },
      ]},
      { group: 'Layout', items: [
        { key: 'appearance.sidebarPosition', label: 'Sidebar Position',   desc: 'Sidebar on left or right.',  type: 'select', opts: ['left','right'], def: 'left' },
        { key: 'appearance.showStatusBar',   label: 'Show Status Bar',     desc: 'Display the status bar.',    type: 'toggle', def: true },
        { key: 'appearance.showActivityBar', label: 'Show Activity Bar',   desc: 'Display the activity bar.', type: 'toggle', def: true },
        { key: 'appearance.showMinimap',     label: 'Show Minimap',        desc: 'Display the code minimap.', type: 'toggle', def: true },
        { key: 'appearance.tabCloseButton',  label: 'Tab Close Button',    desc: 'When to show tab close btn.',type: 'select', opts: ['always','hover','off'], def: 'hover' },
        { key: 'workbench.editor.wrapTabs',  label: 'Wrap Tabs',           desc: 'Wrap tabs to multiple rows.',type: 'toggle', def: false },
        { key: 'workbench.editor.showIcons', label: 'Tab Icons',           desc: 'Show file icons in tabs.',  type: 'toggle', def: true },
      ]},
      { group: 'Window', items: [
        { key: 'window.zoomLevel',    label: 'Zoom Level',    desc: 'Adjust the zoom level (0 = default).',  type: 'number', def: 0, min: -5, max: 10, step: 1 },
        { key: 'window.restoreState', label: 'Restore State', desc: 'Restore last session on reopen.',        type: 'toggle', def: true },
      ]},
    ],

    profiles: [],  // Rendered dynamically in _renderProfiles()

    extensions: [
      { group: 'Marketplace', items: [
        { key: 'extensions.autoUpdate',           label: 'Auto Update',              desc: 'Auto-update installed extensions.',           type: 'toggle', def: true },
        { key: 'extensions.showRecommendations',  label: 'Show Recommendations',     desc: 'Show recommended extensions.',                type: 'toggle', def: true },
        { key: 'extensions.installedFirst',       label: 'Installed First',          desc: 'Show installed extensions at top of list.',   type: 'toggle', def: false },
        { key: 'extensions.checkUpdatesOnStartup',label: 'Check Updates On Startup', desc: 'Check for extension updates on launch.',      type: 'toggle', def: true },
      ]},
    ],

    keyboard: [], // Rendered dynamically via _renderKeyboard()

    files: [
      { group: 'Save', items: [
        { key: 'files.autoSave',           label: 'Auto Save',                desc: 'Controls auto-save behavior.',            type: 'select', opts: ['off','afterDelay','onFocusChange','onWindowChange'], def: 'off' },
        { key: 'files.autoSaveDelay',      label: 'Auto Save Delay (ms)',     desc: 'Delay (ms) for afterDelay auto save.',    type: 'number', def: 1000, min: 100 },
        { key: 'files.trimTrailingWS',     label: 'Trim Trailing Whitespace', desc: 'Remove trailing whitespace on save.',     type: 'toggle', def: false },
        { key: 'files.insertFinalNewline', label: 'Insert Final Newline',     desc: 'Insert a newline at end of file.',        type: 'toggle', def: false },
      ]},
      { group: 'Explorer', items: [
        { key: 'files.excludeNodeModules', label: 'Exclude node_modules', desc: 'Hide node_modules in the explorer.',      type: 'toggle', def: true },
        { key: 'files.excludeGit',         label: 'Exclude .git',         desc: 'Hide the .git folder.',                   type: 'toggle', def: true },
        { key: 'files.sortOrder',          label: 'Sort Order',           desc: 'Explorer file sort order.',               type: 'select', opts: ['default','mixed','filesFirst','type','modified'], def: 'default' },
        { key: 'explorer.confirmDelete',   label: 'Confirm Delete',       desc: 'Ask before deleting files.',              type: 'toggle', def: true },
        { key: 'explorer.compactFolders',  label: 'Compact Folders',      desc: 'Compact single-child folders.',           type: 'toggle', def: true },
        { key: 'explorer.autoReveal',      label: 'Auto Reveal',          desc: 'Reveal active file in explorer.',         type: 'toggle', def: true },
      ]},
      { group: 'Search', items: [
        { key: 'search.useIgnoreFiles',  label: 'Use Ignore Files',  desc: 'Respect .gitignore when searching.',  type: 'toggle', def: true },
        { key: 'search.smartCase',       label: 'Smart Case',        desc: 'Case-sensitive when uppercase used.', type: 'toggle', def: false },
        { key: 'search.maxResults',      label: 'Max Results',       desc: 'Maximum number of search results.',   type: 'number', def: 400, min: 10 },
      ]},
    ],

    git: [
      { group: 'Source Control', items: [
        { key: 'git.enabled',                label: 'Enable Git',                  desc: 'Enable Git integration.',               type: 'toggle', def: true },
        { key: 'git.autofetch',              label: 'Auto Fetch',                  desc: 'Periodically fetch from remotes.',       type: 'toggle', def: false },
        { key: 'git.confirmSync',            label: 'Confirm Sync',                desc: 'Confirm before push/pull.',             type: 'toggle', def: true },
        { key: 'git.enableSmartCommit',      label: 'Smart Commit',                desc: 'Commit all if no staged changes.',      type: 'toggle', def: false },
        { key: 'git.decorations.enabled',    label: 'File Decorations',            desc: 'Show git status in file explorer.',     type: 'toggle', def: true },
        { key: 'git.autoStash',             label: 'Auto Stash',                  desc: 'Stash before rebase/merge.',             type: 'toggle', def: false },
      ]},
      { group: 'Diff', items: [
        { key: 'git.diffAlgorithm',  label: 'Diff Algorithm',  desc: 'Algorithm used for git diff.',  type: 'select', opts: ['default','minimal','patience','histogram'], def: 'default' },
        { key: 'git.showInlineOpen', label: 'Show Inline Open', desc: 'Show open in explorer link.', type: 'toggle', def: true },
      ]},
    ],
  };

  // ── Render a setting item (reads value from NoterSettings) ───
  function _renderItem(item) {
    const val = window.NoterSettings ? NoterSettings.get(item.key) : item.def;
    const cur = val !== undefined ? val : item.def;

    let control = '';
    if (item.type === 'toggle') {
      control = `<label class="stg-toggle">
        <input type="checkbox" ${cur ? 'checked' : ''} data-key="${item.key}"/>
        <span class="stg-track"><span class="stg-thumb"></span></span>
      </label>`;
    } else if (item.type === 'select') {
      const opts = (item.opts || []).map(o =>
        `<option value="${o}" ${String(cur) === o ? 'selected' : ''}>${o}</option>`
      ).join('');
      control = `<select class="stg-select" data-key="${item.key}">${opts}</select>`;
    } else if (item.type === 'number') {
      control = `<input type="number" class="stg-input stg-number"
        data-key="${item.key}" value="${cur}"
        ${item.min !== undefined ? `min="${item.min}"` : ''}
        ${item.max !== undefined ? `max="${item.max}"` : ''}
        ${item.step !== undefined ? `step="${item.step}"` : ''}/>`;
    } else {
      control = `<input type="text" class="stg-input stg-text" data-key="${item.key}" value="${cur ?? ''}"/>`;
    }

    return `<div class="stg-item" data-key="${item.key}">
      <div class="stg-item-info">
        <div class="stg-item-label">${item.label}</div>
        <div class="stg-item-key">${item.key}</div>
        ${item.desc ? `<div class="stg-item-desc">${item.desc}</div>` : ''}
      </div>
      <div class="stg-item-ctrl">${control}</div>
    </div>`;
  }

  function _renderCategory(catId, q = '') {
    if (catId === 'profiles') return _renderProfiles();
    if (catId === 'keyboard') return _renderKeyboard();

    const groups = SETTINGS[catId] || [];
    const lq = q.toLowerCase().trim();
    return groups.map(group => {
      const items = lq
        ? group.items.filter(it => it.label?.toLowerCase().includes(lq) || it.key?.toLowerCase().includes(lq) || it.desc?.toLowerCase().includes(lq))
        : group.items;
      if (!items.length) return '';
      return `<div class="stg-group">
        <div class="stg-group-title">${group.group}</div>
        ${items.map(_renderItem).join('')}
      </div>`;
    }).join('');
  }

  function _renderAllSearch(q) {
    const lq = q.toLowerCase().trim();
    if (!lq) return _renderCategory(currentCat);
    let html = '';
    for (const cat of CATEGORIES) {
      if (cat.id === 'profiles' || cat.id === 'keyboard') continue;
      const catHtml = _renderCategory(cat.id, q);
      if (catHtml) html += `<div class="stg-cat-section">
        <div class="stg-cat-label">${cat.label}</div>${catHtml}</div>`;
    }
    return html || `<div class="stg-empty">No settings match "<strong>${q}</strong>"</div>`;
  }

  // ── Profiles panel ────────────────────────────────────────────
  function _renderProfiles() {
    const profiles    = window.NoterSettings?.getProfiles?.() || {};
    const active      = window.NoterSettings?.getActiveProfile?.();
    const builtin     = Object.keys(window.NoterSettings?.BUILTIN || {});

    const profileCards = Object.entries(profiles).map(([name, _settings]) => {
      const isActive  = name === active;
      const isBuiltin = builtin.includes(name);
      return `<div class="stg-profile-card ${isActive ? 'stg-profile-active' : ''}">
        <div class="stg-profile-name">${name}</div>
        <div class="stg-profile-type">${isBuiltin ? 'Built-in' : 'Custom'}</div>
        <div class="stg-profile-actions">
          <button class="stg-profile-btn stg-profile-apply" data-profile="${name}">
            ${isActive ? '✓ Active' : 'Apply'}
          </button>
          ${!isBuiltin ? `<button class="stg-profile-btn stg-profile-delete" data-profile-del="${name}">Delete</button>` : ''}
        </div>
      </div>`;
    }).join('');

    return `
      <div class="stg-group">
        <div class="stg-group-title">Active Profile: ${active || 'Default'}</div>
        <div class="stg-profiles-grid">${profileCards}</div>
      </div>
      <div class="stg-group">
        <div class="stg-group-title">Create / Import / Export</div>
        <div class="stg-profile-toolbar">
          <button class="stg-profile-toolbar-btn" id="stg-save-profile-btn">
            💾 Save Current as Profile
          </button>
          <button class="stg-profile-toolbar-btn" id="stg-export-settings-btn">
            ⬇ Export Settings
          </button>
          <button class="stg-profile-toolbar-btn" id="stg-import-settings-btn">
            ⬆ Import Settings
          </button>
        </div>
      </div>`;
  }

  function _renderKeyboard() {
    return `
      <div class="stg-group">
        <div class="stg-group-title">Keyboard Shortcuts Editor</div>
        <div class="stg-keyboard-info">
          <p>Manage all keyboard shortcuts — view, change, record, and reset bindings.</p>
          <button class="stg-keyboard-open-btn" id="stg-open-kb-btn">
            ⌨ Open Keyboard Shortcuts Editor
          </button>
        </div>
        <div class="stg-group-title" style="margin-top:20px">Quick Reference</div>
        <table class="kt-table">
          ${[
            ['Ctrl+N','New File'], ['Ctrl+O','Open File'], ['Ctrl+S','Save'],
            ['Ctrl+Shift+S','Save As'], ['Ctrl+W','Close Tab'], ['Ctrl+B','Toggle Sidebar'],
            ['Ctrl+J','Toggle Terminal'], ['Ctrl+Shift+F','Global Search'],
            ['Ctrl+Shift+X','Extensions'], ['Ctrl+Shift+P','Command Palette'],
            ['Ctrl+P','Quick Open'], ['Ctrl+F','Find'], ['Ctrl+H','Replace'],
            ['Ctrl+\\','Split Editor'], ['Alt+Z','Zen Mode'],
            ['Ctrl+D','Duplicate Line'], ['Ctrl+/','Toggle Comment'],
            ['Alt+Shift+F','Format Document'], ['F2','Rename Symbol'],
            ['F12','Go to Definition'], ['Ctrl+G','Go to Line'],
            ['Ctrl+K Ctrl+S','Keyboard Shortcuts'],
          ].map(([k,v]) => `<tr><td class="kt-key"><kbd>${k}</kbd></td><td class="kt-val">${v}</td></tr>`).join('')}
        </table>
      </div>`;
  }

  // ── Build the overlay DOM ─────────────────────────────────────
  function _buildOverlay() {
    const el = document.createElement('div');
    el.id = 'settings-overlay';
    el.innerHTML = `
      <div class="stg-panel" role="dialog" aria-label="Settings">
        <div class="stg-topbar">
          <div class="stg-topbar-left">
            ${_svg('gear')}
            <span class="stg-title">Settings</span>
          </div>
          <div class="stg-topbar-center">
            <div class="stg-search-wrap">
              <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" class="stg-search-icon">
                <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"/>
              </svg>
              <input id="stg-search-input" class="stg-search-input"
                     type="text" placeholder="Search settings…"
                     autocomplete="off" spellcheck="false"/>
            </div>
          </div>
          <div class="stg-topbar-right">
            <button id="stg-close-btn" class="stg-close-btn" title="Close (Esc)">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="stg-body">
          <nav class="stg-nav" id="stg-nav">
            ${CATEGORIES.map(cat => `
              <div class="stg-nav-item ${cat.id === currentCat ? 'stg-nav-active' : ''}" data-cat="${cat.id}">
                <span class="stg-nav-icon">${cat.icon}</span>
                <span class="stg-nav-label">${cat.label}</span>
              </div>`).join('')}
          </nav>
          <div class="stg-content" id="stg-content">
            ${_renderCategory(currentCat)}
          </div>
        </div>
      </div>`;

    document.body.appendChild(el);
    overlay = el;
    _attachEvents(el);
  }

  // ── Event handling (save + apply on every change) ────────────
  function _attachEvents(el) {
    el.querySelector('#stg-close-btn')?.addEventListener('click', close);
    el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    el.addEventListener('click',   e => { if (e.target === el) close(); });

    // Category nav
    el.querySelector('#stg-nav')?.addEventListener('click', e => {
      const item = e.target.closest('.stg-nav-item[data-cat]');
      if (!item) return;
      currentCat = item.dataset.cat;
      el.querySelectorAll('.stg-nav-item').forEach(i => i.classList.toggle('stg-nav-active', i === item));
      const content = el.querySelector('#stg-content');
      if (content) {
        content.innerHTML = searchQuery ? _renderAllSearch(searchQuery) : _renderCategory(currentCat);
        _rebindContent(content);
      }
    });

    // Search
    el.querySelector('#stg-search-input')?.addEventListener('input', e => {
      searchQuery = e.target.value;
      const content = el.querySelector('#stg-content');
      if (content) {
        content.innerHTML = searchQuery ? _renderAllSearch(searchQuery) : _renderCategory(currentCat);
        _rebindContent(content);
      }
    });

    // Setting changes (delegated on content area)
    el.querySelector('#stg-content')?.addEventListener('change', _onSettingChange);

    _rebindContent(el.querySelector('#stg-content'));
  }

  // ── Re-bind dynamic buttons after content re-render ──────────
  function _rebindContent(content) {
    if (!content) return;
    // Setting changes
    content.removeEventListener('change', _onSettingChange);
    content.addEventListener('change', _onSettingChange);

    // Profiles
    content.querySelectorAll('.stg-profile-apply').forEach(btn => btn.addEventListener('click', () => {
      if (window.NoterSettings?.applyProfile?.(btn.dataset.profile)) {
        typeof toast === 'function' && toast(`Profile applied: ${btn.dataset.profile}`, 'info');
        content.innerHTML = _renderCategory('profiles');
        _rebindContent(content);
      }
    }));
    content.querySelectorAll('[data-profile-del]').forEach(btn => btn.addEventListener('click', () => {
      if (!confirm(`Delete profile "${btn.dataset.profileDel}"?`)) return;
      window.NoterSettings?.deleteProfile?.(btn.dataset.profileDel);
      content.innerHTML = _renderCategory('profiles');
      _rebindContent(content);
    }));
    content.querySelector('#stg-save-profile-btn')?.addEventListener('click', () => {
      const name = prompt('Profile name:');
      if (!name?.trim()) return;
      window.NoterSettings?.saveCurrentAsProfile?.(name.trim());
      typeof toast === 'function' && toast(`Profile saved: ${name}`, 'info');
      content.innerHTML = _renderCategory('profiles');
      _rebindContent(content);
    });
    content.querySelector('#stg-export-settings-btn')?.addEventListener('click', () => {
      const json = window.NoterSettings?.exportSettings?.() || '{}';
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([json], { type: 'application/json' })),
        download: 'noter-settings.json',
      });
      a.click(); URL.revokeObjectURL(a.href);
    });
    content.querySelector('#stg-import-settings-btn')?.addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json';
      inp.onchange = async () => {
        const text = await inp.files[0]?.text();
        if (!text) return;
        if (window.NoterSettings?.importSettings?.(text)) {
          typeof toast === 'function' && toast('Settings imported', 'info');
          content.innerHTML = _renderCategory(currentCat);
          _rebindContent(content);
        } else {
          typeof toast === 'function' && toast('Invalid settings file', 'error');
        }
      };
      inp.click();
    });

    // Keyboard shortcuts open button
    content.querySelector('#stg-open-kb-btn')?.addEventListener('click', () => {
      close();
      setTimeout(() => window.KeybindingsUI?.open?.(), 100);
    });
  }

  // ── Apply a setting immediately ───────────────────────────────
  function _onSettingChange(e) {
    const el  = e.target.closest('[data-key]');
    if (!el) return;
    const key = el.dataset.key || e.target.dataset.key;
    if (!key) return;

    let value;
    if (e.target.type === 'checkbox') value = e.target.checked;
    else if (e.target.type === 'number') value = parseFloat(e.target.value);
    else value = e.target.value;

    // Save to NoterSettings
    if (window.NoterSettings) {
      NoterSettings.set(key, value);
    }

    // Apply immediately
    _applySettingLive(key, value);
  }

  function _applySettingLive(key, value) {
    const ed = window.editor;

    // ── Editor options ────────────────────────────────────────
    const editorDirect = {
      'editor.fontSize':           v => ed?.updateOptions({ fontSize: v }),
      'editor.fontFamily':         v => ed?.updateOptions({ fontFamily: v }),
      'editor.lineHeight':         v => ed?.updateOptions({ lineHeight: v }),
      'editor.letterSpacing':      v => ed?.updateOptions({ letterSpacing: v }),
      'editor.wordWrap':           v => ed?.updateOptions({ wordWrap: v }),
      'editor.tabSize':            v => ed?.updateOptions({ tabSize: +v }),
      'editor.insertSpaces':       v => ed?.updateOptions({ insertSpaces: v }),
      'editor.cursorStyle':        v => ed?.updateOptions({ cursorStyle: v }),
      'editor.cursorBlinking':     v => ed?.updateOptions({ cursorBlinking: v }),
      'editor.cursorWidth':        v => ed?.updateOptions({ cursorWidth: +v }),
      'editor.lineNumbers':        v => ed?.updateOptions({ lineNumbers: v }),
      'editor.smoothScrolling':    v => ed?.updateOptions({ smoothScrolling: v }),
      'editor.mouseWheelZoom':     v => ed?.updateOptions({ mouseWheelZoom: v }),
      'editor.renderWhitespace':   v => ed?.updateOptions({ renderWhitespace: v }),
      'editor.renderLineHighlight':v => ed?.updateOptions({ renderLineHighlight: v }),
      'editor.linkedEditing':      v => ed?.updateOptions({ linkedEditing: v }),
      'editor.occurrencesHighlight':v => ed?.updateOptions({ occurrencesHighlight: v }),
      'editor.selectionHighlight': v => ed?.updateOptions({ selectionHighlight: v }),
      'editor.codeLens':           v => ed?.updateOptions({ codeLens: v }),
      'editor.minimap.enabled':    v => ed?.updateOptions({ minimap: { enabled: v } }),
      'editor.bracketPairColorization.enabled': v => ed?.updateOptions({ bracketPairColorization: { enabled: v } }),
      'editor.guides.bracketPairs': v => ed?.updateOptions({ guides: { bracketPairs: v } }),
      'editor.stickyScroll.enabled': v => ed?.updateOptions({ stickyScroll: { enabled: v } }),
      'editor.inlineSuggest.enabled': v => ed?.updateOptions({ inlineSuggest: { enabled: v } }),
      'editor.quickSuggestions':   v => ed?.updateOptions({ quickSuggestions: { other: v, comments: false, strings: false } }),
      'editor.parameterHints':     v => ed?.updateOptions({ parameterHints: { enabled: v } }),
      'editor.autoClosingBrackets': v => ed?.updateOptions({ autoClosingBrackets: v ? 'always' : 'never' }),
      'editor.autoClosingQuotes':  v => ed?.updateOptions({ autoClosingQuotes: v ? 'always' : 'never' }),
      'editor.autoIndent':         v => ed?.updateOptions({ autoIndent: v }),
      'editor.wordBasedSuggestions': v => ed?.updateOptions({ wordBasedSuggestions: v }),
      'editor.tabCompletion':      v => ed?.updateOptions({ tabCompletion: v }),
      'appearance.showMinimap':    v => ed?.updateOptions({ minimap: { enabled: v } }),
      // Window zoom
      'window.zoomLevel':          v => {
        try { window.electronAPI?.setZoom?.(v); } catch {}
        if (typeof require !== 'undefined') {
          try { require('electron').webFrame?.setZoomLevel?.(v); } catch {}
        }
      },
      // Status / Activity bar visibility
      'appearance.showStatusBar':  v => {
        const sb = document.getElementById('statusbar');
        if (sb) sb.style.display = v ? '' : 'none';
      },
      'appearance.showActivityBar': v => {
        const ab = document.getElementById('activity-bar') || document.querySelector('.activity-bar');
        if (ab) ab.style.display = v ? '' : 'none';
      },
      // Theme
      'appearance.colorTheme': v => _applyTheme(v),
      // Formatonsave — handled by prettier extension hook
    };

    if (editorDirect[key]) {
      try { editorDirect[key](value); } catch {}
    }
  }

  function _applyTheme(name) {
    if (typeof monaco === 'undefined') return;
    const MAP = {
      'GitHub Dark':        'github-dark',
      'GitHub Dark Dimmed': 'github-dark-dimmed',
      'VS Code Dark Modern':'vs-dark',
    };
    const themeId = MAP[name] || 'vs-dark';
    try {
      if (themeId === 'vs-dark') {
        monaco.editor.setTheme('vs-dark');
      } else {
        monaco.editor.setTheme(themeId);
      }
    } catch {}
  }

  // ── Open / Close ──────────────────────────────────────────────
  function open(cat) {
    if (!overlay) _buildOverlay();
    if (cat && SETTINGS[cat] !== undefined) {
      currentCat = cat;
      overlay.querySelectorAll('.stg-nav-item').forEach(i =>
        i.classList.toggle('stg-nav-active', i.dataset.cat === cat));
      const content = overlay.querySelector('#stg-content');
      if (content) {
        content.innerHTML = _renderCategory(cat);
        _rebindContent(content);
      }
    }
    overlay.classList.add('settings-visible');
    setTimeout(() => overlay.querySelector('#stg-search-input')?.focus(), 60);
  }

  function close() {
    overlay?.classList.remove('settings-visible');
    if (typeof ActivityBar !== 'undefined') {
      ActivityBar.setActive(window.sidebarVisible ? 'explorer' : null);
    }
  }

  // ── SVG icon helpers ──────────────────────────────────────────
  function _svg(name) {
    const icons = {
      edit:   `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064Zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354Z"/></svg>`,
      term:   `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 14.25 15H1.75A1.75 1.75 0 0 1 0 13.25Zm1.75-.25a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25ZM7.25 8a.75.75 0 0 1-.22.53l-2.25 2.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L5.44 8 3.72 6.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018l2.25 2.25c.141.14.22.331.22.53Zm1.5 1.5h3a.75.75 0 0 1 0 1.5h-3a.75.75 0 0 1 0-1.5Z"/></svg>`,
      appear: `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1ZM4.5 6.5a.5.5 0 0 0-.5.5v2.5a.5.5 0 0 0 1 0V7a.5.5 0 0 0-.5-.5Zm3 0a.5.5 0 0 0-.5.5v2.5a.5.5 0 0 0 1 0V7a.5.5 0 0 0-.5-.5Zm3 0a.5.5 0 0 0-.5.5v2.5a.5.5 0 0 0 1 0V7a.5.5 0 0 0-.5-.5Z"/></svg>`,
      prof:   `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M10.561 8.073a6.005 6.005 0 0 1 3.432 5.142.75.75 0 1 1-1.498.07 4.5 4.5 0 0 0-8.99 0 .75.75 0 0 1-1.498-.07 6.004 6.004 0 0 1 3.431-5.142 3.999 3.999 0 1 1 5.123 0ZM10.5 5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/></svg>`,
      ext:    `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M2 2.5A1.5 1.5 0 0 1 3.5 1h6.536c.464 0 .893.19 1.204.5l2.76 2.76c.311.311.5.74.5 1.204V13.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5Zm1.5-.25a.25.25 0 0 0-.25.25v11c0 .138.112.25.25.25h9a.25.25 0 0 0 .25-.25V6h-2.5A1.75 1.75 0 0 1 8.5 4.25V1.75Z"/></svg>`,
      key:    `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M0 5.75A5.75 5.75 0 0 1 11.5 5a4.5 4.5 0 0 1 4.496 4.502.75.75 0 0 1-1.5.002A3 3 0 0 0 11.5 6.5a4.25 4.25 0 1 0 0 8.5h3.25a.75.75 0 0 1 0 1.5H11.5A5.75 5.75 0 0 1 0 10.75v-5Z"/></svg>`,
      file:   `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Z"/></svg>`,
      git:    `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M15.698 7.287 8.712.302a1.03 1.03 0 0 0-1.457 0l-1.45 1.45 1.84 1.84a1.223 1.223 0 0 1 1.55 1.56l1.773 1.774a1.224 1.224 0 0 1 1.267 2.025 1.226 1.226 0 0 1-2.002-1.334L8.58 5.963v4.353a1.226 1.226 0 1 1-1.008-.036V5.887a1.226 1.226 0 0 1-.666-1.608L5.093 2.44 .302 7.231a1.03 1.03 0 0 0 0 1.457l6.986 6.986a1.03 1.03 0 0 0 1.457 0l6.953-6.953a1.031 1.031 0 0 0 0-1.434Z"/></svg>`,
      gear:   `<svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54C14.71 2.17 14.51 2 14.27 2H9.73c-.24 0-.44.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.38 8.47c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.24.41.48.41h4.54c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6S10.02 8.4 12 8.4s3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="currentColor"/></svg>`,
    };
    return icons[name] || '';
  }

  // ── Expose globals ────────────────────────────────────────────
  window.SettingsUI = { open, close };

  // Register command
  document.addEventListener('DOMContentLoaded', () => {
    window.NoterCommands?.register({
      id: 'workbench.settings',
      title: 'Open Settings',
      category: 'Workspace',
      description: 'Open the settings panel',
      aliases: ['settings','preferences','config'],
      handler: () => open(),
    });
  });

  return { open, close };
})();

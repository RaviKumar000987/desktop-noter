// ═══════════════════════════════════════════════════════════════
//  SETTINGS UI — settings-ui.js
//  VS Code-inspired settings shell with category nav + search
// ═══════════════════════════════════════════════════════════════

const SettingsUI = (() => {
  let overlay      = null;
  let currentCat   = "editor";
  let searchQuery  = "";

  // ── Category definitions ──────────────────────────────────────
  const CATEGORIES = [
    { id: "editor",      label: "Editor",       icon: svgEdit()    },
    { id: "terminal",    label: "Terminal",      icon: svgTerm()    },
    { id: "appearance",  label: "Appearance",    icon: svgAppear()  },
    { id: "extensions",  label: "Extensions",    icon: svgExt()     },
    { id: "keyboard",    label: "Keyboard",      icon: svgKey()     },
    { id: "files",       label: "Files",         icon: svgFile()    },
    { id: "git",         label: "Git",           icon: svgGit()     },
  ];

  // ── Settings data ─────────────────────────────────────────────
  const SETTINGS = {
    editor: [
      { group: "Font", items: [
        { key: "editor.fontSize",    label: "Font Size",           desc: "Controls the font size in pixels.", type: "number", def: 18, min: 8, max: 72 },
        { key: "editor.fontFamily",  label: "Font Family",         desc: "Controls the font family.", type: "text", def: "Cascadia Code, Fira Code, Consolas" },
        { key: "editor.lineHeight",  label: "Line Height",         desc: "Controls the line height.", type: "number", def: 1.5, min: 1, max: 4 },
        { key: "editor.letterSpacing", label: "Letter Spacing",    desc: "Controls letter spacing in px.", type: "number", def: 0 },
      ]},
      { group: "Editing", items: [
        { key: "editor.wordWrap",           label: "Word Wrap",              desc: "Controls how lines are wrapped.", type: "select", opts: ["off","on","wordWrapColumn","bounded"], def: "on" },
        { key: "editor.tabSize",            label: "Tab Size",               desc: "The number of spaces a tab is equal to.", type: "number", def: 4, min: 1, max: 16 },
        { key: "editor.insertSpaces",       label: "Insert Spaces",          desc: "Insert spaces when pressing Tab.", type: "toggle", def: true },
        { key: "editor.formatOnSave",       label: "Format On Save",         desc: "Format a file on save.", type: "toggle", def: false },
        { key: "editor.formatOnPaste",      label: "Format On Paste",        desc: "Format pasted content.", type: "toggle", def: false },
        { key: "editor.trimAutoWhitespace", label: "Trim Auto Whitespace",   desc: "Trim trailing whitespace when editing a line.", type: "toggle", def: true },
        { key: "editor.detectIndentation",  label: "Detect Indentation",     desc: "Detect indentation from file content.", type: "toggle", def: true },
      ]},
      { group: "Cursor", items: [
        { key: "editor.cursorStyle",     label: "Cursor Style",    desc: "Controls the cursor style.", type: "select", opts: ["block","underline","line","block-outline","underline-thin","line-thin"], def: "line" },
        { key: "editor.cursorBlinking",  label: "Cursor Blinking", desc: "Controls the cursor animation.", type: "select", opts: ["blink","smooth","phase","expand","solid"], def: "blink" },
        { key: "editor.cursorWidth",     label: "Cursor Width",    desc: "Controls the cursor width when style is line.", type: "number", def: 2 },
      ]},
      { group: "Display", items: [
        { key: "editor.lineNumbers",         label: "Line Numbers",        desc: "Controls the display of line numbers.", type: "select", opts: ["on","off","relative","interval"], def: "on" },
        { key: "editor.minimap.enabled",     label: "Minimap",             desc: "Enable the minimap.", type: "toggle", def: true },
        { key: "editor.renderWhitespace",    label: "Render Whitespace",   desc: "Controls rendering of whitespace.", type: "select", opts: ["none","boundary","selection","trailing","all"], def: "selection" },
        { key: "editor.renderLineHighlight", label: "Render Line Highlight",desc: "Highlight the current line.", type: "select", opts: ["none","gutter","line","all"], def: "all" },
        { key: "editor.smoothScrolling",     label: "Smooth Scrolling",    desc: "Animate scrolling.", type: "toggle", def: false },
        { key: "editor.mouseWheelZoom",      label: "Mouse Wheel Zoom",    desc: "Zoom using Ctrl + mouse wheel.", type: "toggle", def: false },
        { key: "editor.bracketPairColorization.enabled", label: "Bracket Pair Colorization", desc: "Enable bracket pair colorization.", type: "toggle", def: true },
      ]},
      { group: "IntelliSense", items: [
        { key: "editor.quickSuggestions",      label: "Quick Suggestions",      desc: "Enable inline suggestions.", type: "toggle", def: true },
        { key: "editor.parameterHints",        label: "Parameter Hints",        desc: "Enable parameter hints popup.", type: "toggle", def: true },
        { key: "editor.autoClosingBrackets",   label: "Auto Closing Brackets",  desc: "Enable auto closing brackets.", type: "toggle", def: true },
        { key: "editor.autoClosingQuotes",     label: "Auto Closing Quotes",    desc: "Enable auto closing quotes.", type: "toggle", def: true },
        { key: "editor.suggestOnTriggerCharacters", label: "Suggest On Trigger Characters", desc: "Enable suggestions after trigger chars.", type: "toggle", def: true },
      ]},
    ],

    terminal: [
      { group: "Shell", items: [
        { key: "terminal.shell",       label: "Default Shell",    desc: "Leave blank to use the system default.", type: "text",   def: "" },
        { key: "terminal.fontSize",    label: "Font Size",        desc: "Controls the font size in the terminal.", type: "number", def: 13, min: 8, max: 36 },
        { key: "terminal.fontFamily",  label: "Font Family",      desc: "Terminal font family.", type: "text",   def: "Cascadia Code, Fira Code, Consolas" },
        { key: "terminal.lineHeight",  label: "Line Height",      desc: "Terminal line height.", type: "number", def: 1.35 },
      ]},
      { group: "Behavior", items: [
        { key: "terminal.cursorBlink",     label: "Cursor Blink",      desc: "Whether the terminal cursor blinks.", type: "toggle", def: true },
        { key: "terminal.cursorStyle",     label: "Cursor Style",      desc: "The terminal cursor style.", type: "select", opts: ["block","underline","bar"], def: "block" },
        { key: "terminal.scrollback",      label: "Scrollback Lines",  desc: "Number of scrollback lines.", type: "number", def: 5000, min: 0 },
        { key: "terminal.copyOnSelection", label: "Copy On Selection", desc: "Auto-copy selected text.", type: "toggle", def: false },
      ]},
    ],

    appearance: [
      { group: "Theme", items: [
        { key: "appearance.colorTheme", label: "Color Theme",     desc: "Specifies the color theme.", type: "select", opts: ["GitHub Dark","GitHub Dark Dimmed","VS Code Dark Modern"], def: "GitHub Dark" },
        { key: "appearance.iconTheme",  label: "File Icon Theme", desc: "Specifies the file icon theme.", type: "select", opts: ["Default","None"], def: "Default" },
      ]},
      { group: "Layout", items: [
        { key: "appearance.sidebarPosition", label: "Sidebar Position",  desc: "Position of the sidebar.", type: "select", opts: ["left","right"], def: "left" },
        { key: "appearance.showStatusBar",   label: "Status Bar",         desc: "Show the status bar.", type: "toggle", def: true },
        { key: "appearance.showActivityBar", label: "Activity Bar",        desc: "Show the activity bar.", type: "toggle", def: true },
        { key: "appearance.showMinimap",     label: "Minimap",            desc: "Show the editor minimap.", type: "toggle", def: true },
        { key: "appearance.tabCloseButton",  label: "Tab Close Button",   desc: "Controls the tab close button.", type: "select", opts: ["always","hover","off"], def: "hover" },
      ]},
      { group: "Window", items: [
        { key: "window.zoomLevel",     label: "Zoom Level",    desc: "Adjust zoom level (0 = default).", type: "number", def: 0 },
        { key: "window.restoreState",  label: "Restore State", desc: "Restore tabs and workspace on reopen.", type: "toggle", def: true },
      ]},
    ],

    extensions: [
      { group: "Marketplace", items: [
        { key: "extensions.autoUpdate",           label: "Auto Update",              desc: "Auto-update installed extensions.", type: "toggle", def: true },
        { key: "extensions.showRecommendations",  label: "Show Recommendations",     desc: "Show extension recommendations.", type: "toggle", def: true },
        { key: "extensions.installedFirst",       label: "Installed First",          desc: "Show installed extensions at top.", type: "toggle", def: false },
        { key: "extensions.checkUpdatesOnStartup",label: "Check Updates On Startup", desc: "Check for extension updates on launch.", type: "toggle", def: true },
      ]},
    ],

    keyboard: [
      { group: "Shortcuts Reference", items: [
        { key: "_info", label: "Common Shortcuts", type: "keytable",
          rows: [
            ["Ctrl+N",       "New File"],
            ["Ctrl+O",       "Open File"],
            ["Ctrl+S",       "Save"],
            ["Ctrl+Shift+S", "Save As"],
            ["Ctrl+W",       "Close Tab"],
            ["Ctrl+T",       "New Tab"],
            ["Ctrl+B",       "Toggle Explorer"],
            ["Ctrl+J",       "Toggle Terminal"],
            ["Ctrl+Shift+F", "Global Search"],
            ["Ctrl+Shift+X", "Extensions"],
            ["Ctrl+Shift+P", "Command Palette"],
            ["Ctrl+P",       "Quick Open"],
            ["Ctrl+F",       "Find"],
            ["Ctrl+H",       "Find & Replace"],
            ["Ctrl+\\",      "Split Editor"],
            ["Ctrl+Z",       "Undo"],
            ["Ctrl+Y",       "Redo"],
          ],
        },
      ]},
    ],

    files: [
      { group: "Save", items: [
        { key: "files.autoSave",           label: "Auto Save",              desc: "Controls auto save.", type: "select", opts: ["off","afterDelay","onFocusChange","onWindowChange"], def: "off" },
        { key: "files.autoSaveDelay",      label: "Auto Save Delay (ms)",   desc: "Delay for afterDelay auto save.", type: "number", def: 1000 },
        { key: "files.trimTrailingWS",     label: "Trim Trailing Whitespace",desc: "Trim trailing whitespace on save.", type: "toggle", def: false },
        { key: "files.insertFinalNewline", label: "Insert Final Newline",   desc: "Insert a newline at end of file on save.", type: "toggle", def: false },
      ]},
      { group: "Explorer", items: [
        { key: "files.excludeNodeModules", label: "Exclude node_modules", desc: "Hide node_modules in explorer.", type: "toggle", def: true },
        { key: "files.excludeGit",         label: "Exclude .git",         desc: "Hide .git folder in explorer.", type: "toggle", def: true },
        { key: "files.sortOrder",          label: "Sort Order",           desc: "Sort order for explorer.", type: "select", opts: ["default","mixed","type","modified"], def: "default" },
      ]},
    ],

    git: [
      { group: "Source Control", items: [
        { key: "git.enabled",     label: "Enable Git",       desc: "Enable Git source control features.", type: "toggle", def: true },
        { key: "git.autofetch",   label: "Auto Fetch",       desc: "Periodically fetch remotes.", type: "toggle", def: false },
        { key: "git.confirmSync", label: "Confirm Sync",     desc: "Confirm before push/pull.", type: "toggle", def: true },
      ]},
      { group: "Diff", items: [
        { key: "git.diffAlgorithm",  label: "Diff Algorithm",  desc: "Algorithm for git diff.", type: "select", opts: ["default","minimal","patience","histogram"], def: "default" },
        { key: "git.showInlineOpen", label: "Show Inline Open", desc: "Show git open in file explorer.", type: "toggle", def: true },
      ]},
    ],
  };

  // ── Render a settings item ────────────────────────────────────
  function renderItem(item) {
    if (item.type === "keytable") return renderKeyTable(item);

    let control = "";
    if (item.type === "toggle") {
      control = `
        <label class="stg-toggle" title="${item.desc || ""}">
          <input type="checkbox" ${item.def ? "checked" : ""} data-key="${item.key}"/>
          <span class="stg-track"><span class="stg-thumb"></span></span>
        </label>`;
    } else if (item.type === "select") {
      const opts = (item.opts || []).map((o) =>
        `<option value="${o}" ${o === item.def ? "selected" : ""}>${o}</option>`
      ).join("");
      control = `<select class="stg-select" data-key="${item.key}">${opts}</select>`;
    } else if (item.type === "number") {
      control = `<input type="number" class="stg-input stg-number"
        data-key="${item.key}" value="${item.def}"
        ${item.min !== undefined ? `min="${item.min}"` : ""}
        ${item.max !== undefined ? `max="${item.max}"` : ""}/>`;
    } else {
      control = `<input type="text" class="stg-input stg-text" data-key="${item.key}" value="${item.def ?? ""}"/>`;
    }

    return `
      <div class="stg-item" data-key="${item.key}" data-label="${(item.label || "").toLowerCase()}">
        <div class="stg-item-info">
          <div class="stg-item-label">${item.label}</div>
          <div class="stg-item-key">${item.key}</div>
          ${item.desc ? `<div class="stg-item-desc">${item.desc}</div>` : ""}
        </div>
        <div class="stg-item-ctrl">${control}</div>
      </div>`;
  }

  function renderKeyTable(item) {
    const rows = (item.rows || []).map(([k, v]) =>
      `<tr><td class="kt-key"><kbd>${k}</kbd></td><td class="kt-val">${v}</td></tr>`
    ).join("");
    return `
      <div class="stg-item stg-keytable">
        <table class="kt-table">${rows}</table>
      </div>`;
  }

  function renderCategory(catId, q = "") {
    const groups = SETTINGS[catId] || [];
    const lq = q.toLowerCase().trim();

    return groups.map((group) => {
      const filteredItems = lq
        ? group.items.filter((it) =>
            it.label?.toLowerCase().includes(lq) ||
            it.key?.toLowerCase().includes(lq) ||
            it.desc?.toLowerCase().includes(lq)
          )
        : group.items;

      if (!filteredItems.length) return "";

      return `
        <div class="stg-group">
          <div class="stg-group-title">${group.group}</div>
          ${filteredItems.map(renderItem).join("")}
        </div>`;
    }).join("");
  }

  function renderAllSearch(q) {
    const lq = q.toLowerCase().trim();
    if (!lq) return renderCategory(currentCat);

    let html = "";
    for (const cat of CATEGORIES) {
      const catHtml = renderCategory(cat.id, q);
      if (catHtml) {
        html += `<div class="stg-cat-section">
          <div class="stg-cat-label">${cat.label}</div>
          ${catHtml}
        </div>`;
      }
    }
    return html || `<div class="stg-empty">No settings match "<strong>${q}</strong>"</div>`;
  }

  // ── Build overlay DOM ─────────────────────────────────────────
  function buildOverlay() {
    const el = document.createElement("div");
    el.id = "settings-overlay";
    el.innerHTML = `
      <div class="stg-panel" role="dialog" aria-label="Settings">
        <div class="stg-topbar">
          <div class="stg-topbar-left">
            <svg class="stg-logo-icon" viewBox="0 0 24 24" width="18" height="18" fill="none">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54C14.71 2.17 14.51 2 14.27 2H9.73c-.24 0-.44.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.38 8.47c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.24.41.48.41h4.54c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6S10.02 8.4 12 8.4s3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="currentColor"/>
            </svg>
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
            ${CATEGORIES.map((cat) => `
              <div class="stg-nav-item ${cat.id === currentCat ? "stg-nav-active" : ""}"
                   data-cat="${cat.id}">
                <span class="stg-nav-icon">${cat.icon}</span>
                <span class="stg-nav-label">${cat.label}</span>
              </div>
            `).join("")}
          </nav>

          <div class="stg-content" id="stg-content">
            ${renderCategory(currentCat)}
          </div>
        </div>
      </div>`;

    document.body.appendChild(el);
    overlay = el;

    // Close button
    document.getElementById("stg-close-btn")?.addEventListener("click", close);

    // Escape key
    el.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.stopPropagation(); close(); }
    });

    // Click outside panel
    el.addEventListener("click", (e) => {
      if (e.target === el) close();
    });

    // Category nav
    document.getElementById("stg-nav")?.addEventListener("click", (e) => {
      const item = e.target.closest(".stg-nav-item[data-cat]");
      if (!item) return;
      currentCat = item.dataset.cat;
      document.querySelectorAll(".stg-nav-item").forEach((i) =>
        i.classList.toggle("stg-nav-active", i === item)
      );
      const content = document.getElementById("stg-content");
      if (content) content.innerHTML = searchQuery ? renderAllSearch(searchQuery) : renderCategory(currentCat);
    });

    // Search
    document.getElementById("stg-search-input")?.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      const content = document.getElementById("stg-content");
      if (content) content.innerHTML = searchQuery ? renderAllSearch(searchQuery) : renderCategory(currentCat);
    });
  }

  // ── Open / Close ──────────────────────────────────────────────
  function open() {
    if (!overlay) buildOverlay();
    overlay.classList.add("settings-visible");
    setTimeout(() => document.getElementById("stg-search-input")?.focus(), 60);
  }

  function close() {
    overlay?.classList.remove("settings-visible");
    // Sync activity bar
    if (typeof ActivityBar !== "undefined") {
      const prevPanel = window.sidebarVisible ? "explorer" : null;
      ActivityBar.setActive(prevPanel);
    }
  }

  // ── SVG icon helpers ──────────────────────────────────────────
  function svgEdit()   { return `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064Zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354Z"/></svg>`; }
  function svgTerm()   { return `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 14.25 15H1.75A1.75 1.75 0 0 1 0 13.25Zm1.75-.25a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25ZM7.25 8a.75.75 0 0 1-.22.53l-2.25 2.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L5.44 8 3.72 6.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018l2.25 2.25c.141.14.22.331.22.53Zm1.5 1.5h3a.75.75 0 0 1 0 1.5h-3a.75.75 0 0 1 0-1.5Z"/></svg>`; }
  function svgAppear() { return `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1ZM4.5 6.5a.5.5 0 0 0-.5.5v2.5a.5.5 0 0 0 1 0V7a.5.5 0 0 0-.5-.5Zm3 0a.5.5 0 0 0-.5.5v2.5a.5.5 0 0 0 1 0V7a.5.5 0 0 0-.5-.5Zm3 0a.5.5 0 0 0-.5.5v2.5a.5.5 0 0 0 1 0V7a.5.5 0 0 0-.5-.5Z"/></svg>`; }
  function svgExt()    { return `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M13.257 7H11a1 1 0 0 1-1-1V3.743L13.257 7ZM2 2.5A1.5 1.5 0 0 1 3.5 1h6.536c.464 0 .893.19 1.204.5l2.76 2.76c.311.311.5.74.5 1.204V13.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5Zm1.5-.25a.25.25 0 0 0-.25.25v11c0 .138.112.25.25.25h9a.25.25 0 0 0 .25-.25V6h-2.5A1.75 1.75 0 0 1 8.5 4.25V1.75Z"/></svg>`; }
  function svgKey()    { return `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M0 5.75A5.75 5.75 0 0 1 11.5 5a4.5 4.5 0 0 1 4.496 4.502.75.75 0 0 1-1.5.002A3 3 0 0 0 11.5 6.5a4.25 4.25 0 1 0 0 8.5h3.25a.75.75 0 0 1 0 1.5H11.5A5.75 5.75 0 0 1 0 10.75v-5ZM5.75 6.5a4.25 4.25 0 1 0 0 8.5 4.25 4.25 0 0 0 0-8.5ZM2.5 10.75a3.25 3.25 0 1 1 6.5 0 3.25 3.25 0 0 1-6.5 0Z"/></svg>`; }
  function svgFile()   { return `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 8.75 4.25V1.5Zm6.75.56v2.19c0 .138.112.25.25.25h2.19Z"/></svg>`; }
  function svgGit()    { return `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M15.698 7.287 8.712.302a1.03 1.03 0 0 0-1.457 0l-1.45 1.45 1.84 1.84a1.223 1.223 0 0 1 1.55 1.56l1.773 1.774a1.224 1.224 0 0 1 1.267 2.025 1.226 1.226 0 0 1-2.002-1.334L8.58 5.963v4.353a1.226 1.226 0 1 1-1.008-.036V5.887a1.226 1.226 0 0 1-.666-1.608L5.093 2.44 .302 7.231a1.03 1.03 0 0 0 0 1.457l6.986 6.986a1.03 1.03 0 0 0 1.457 0l6.953-6.953a1.031 1.031 0 0 0 0-1.434Z"/></svg>`; }

  // ── Expose globally ───────────────────────────────────────────
  window.SettingsUI = { open, close };

  return { open, close };
})();

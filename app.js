// ═══════════════════════════════════════════════════════════════
//  NOTER APP — app.js
//  Features: Multi-Tab · Project Explorer · Workspace
// ═══════════════════════════════════════════════════════════════

// ─── Monaco Loader config (must run before require calls) ───────
require.config({ paths: { vs: "./node_modules/monaco-editor/min/vs" } });

// ─── Settings & runtime state ───────────────────────────────────
let editorFontSize   = 18;
let wordWrapEnabled  = true;
let sidebarVisible   = true;
let sidebarWidth     = 220;

// ─── Utility ────────────────────────────────────────────────────
function basename(p) {
  if (!p) return "Untitled";
  return p.replace(/\\/g, "/").split("/").filter(Boolean).pop() || p;
}

// ─── Language detection ─────────────────────────────────────────
const EXT_TO_LANG = {
  js:"javascript", mjs:"javascript", cjs:"javascript",
  ts:"typescript", jsx:"javascript", tsx:"typescript",
  html:"html", htm:"html",
  css:"css", scss:"scss", less:"less",
  json:"json", jsonc:"json",
  md:"markdown", markdown:"markdown",
  py:"python", rb:"ruby", php:"php", java:"java",
  c:"c", h:"c", cpp:"cpp", cc:"cpp",
  cs:"csharp", go:"go", rs:"rust",
  sh:"shell", bash:"shell",
  xml:"xml", svg:"xml",
  yaml:"yaml", yml:"yaml",
  sql:"sql", txt:"plaintext",
};

const LANG_DISPLAY = {
  javascript:"JavaScript", typescript:"TypeScript",
  html:"HTML", css:"CSS", scss:"SCSS", less:"LESS",
  json:"JSON", markdown:"Markdown", python:"Python",
  ruby:"Ruby", php:"PHP", java:"Java", c:"C",
  cpp:"C++", csharp:"C#", go:"Go", rust:"Rust",
  shell:"Shell", xml:"XML", yaml:"YAML", sql:"SQL",
  plaintext:"Plain Text",
};

function getLang(filePath) {
  if (!filePath) return "plaintext";
  const ext = filePath.split(".").pop().toLowerCase();
  return EXT_TO_LANG[ext] || "plaintext";
}
function getLangDisplay(lang) {
  return LANG_DISPLAY[lang] || lang;
}

// ─── File-type colours (for explorer) ───────────────────────────
const EXT_COLOR = {
  js:"#f9e2af", mjs:"#f9e2af", cjs:"#f9e2af",
  ts:"#89b4fa", jsx:"#f9e2af", tsx:"#89b4fa",
  html:"#fab387", htm:"#fab387",
  css:"#89dceb", scss:"#f5c2e7", less:"#cba6f7",
  json:"#a6e3a1", jsonc:"#a6e3a1",
  md:"#94e2d5", markdown:"#94e2d5",
  py:"#89b4fa", rs:"#fab387", go:"#89dceb",
  rb:"#f38ba8", java:"#fab387",
  c:"#89b4fa", h:"#89b4fa", cpp:"#89b4fa", cc:"#89b4fa",
  cs:"#a6e3a1", sh:"#a6e3a1", bash:"#a6e3a1",
  xml:"#fab387", svg:"#f5c2e7",
  yaml:"#f38ba8", yml:"#f38ba8",
  sql:"#89b4fa", txt:"#9399b2",
  env:"#f9e2af", gitignore:"#f38ba8",
};
function getFileColor(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  // Special dotfiles
  if (name === ".env")        return "#f9e2af";
  if (name === ".gitignore")  return "#f38ba8";
  return EXT_COLOR[ext] || "#7f849c";
}

// ═══════════════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════
function showToast(message, type = "info", duration = 2200) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s";
    setTimeout(() => toast.remove(), 320);
  }, duration);
}

// ═══════════════════════════════════════════════════════════════
//  TAB MANAGER
// ═══════════════════════════════════════════════════════════════
const TabManager = {
  tabs:     [],
  activeId: null,
  _uid:     1,

  /**
   * Create a new tab with its own Monaco model.
   * Call ONLY after Monaco is initialised.
   */
  create(filePath = null, content = "", language = null) {
    const id   = "tab-" + this._uid++;
    const lang = language || getLang(filePath);
    const uri  = monaco.Uri.parse("noter://tab/" + id);
    const model = monaco.editor.createModel(content, lang, uri);

    const tab = {
      id, filePath,
      title:      filePath ? basename(filePath) : "Untitled",
      language:   lang,
      isModified: false,
      viewState:  null,
      model,
    };

    // Per-model content change → track dirty state
    model.onDidChangeContent((e) => {
      if (e.isFlush) return;               // programmatic setValue — not dirty
      if (!tab.isModified) {
        tab.isModified = true;
        renderTabs();
        updateTitleBar();
      }
      if (TabManager.activeId === id) updateCounts();
    });

    this.tabs.push(tab);
    return tab;
  },

  get(id)      { return this.tabs.find(t => t.id === id); },
  getActive()  { return this.get(this.activeId); },

  /** Switch to tab `id`, saving the current editor view-state first. */
  activate(id) {
    const prev = this.getActive();
    if (prev && window.editor) {
      prev.viewState = window.editor.saveViewState();
    }

    this.activeId = id;
    const tab = this.get(id);
    if (!tab) return;

    if (window.editor) {
      window.editor.setModel(tab.model);
      if (tab.viewState) window.editor.restoreViewState(tab.viewState);
      window.editor.focus();
    }

    updateStatusBar();
    updateTitleBar();
    renderTabs();
    updateExplorerActiveFile();
    saveSessionState();
  },

  /** Close a tab (prompts if unsaved). Returns true if closed. */
  close(id, force = false) {
    const tab = this.get(id);
    if (!tab) return false;

    if (!force && tab.isModified) {
      if (!confirm(`"${tab.title}" has unsaved changes.\nClose without saving?`)) return false;
    }

    const idx = this.tabs.findIndex(t => t.id === id);
    tab.model.dispose();
    this.tabs.splice(idx, 1);

    if (this.activeId === id) {
      // Prefer the tab to the right, then left
      const next = this.tabs[idx] || this.tabs[idx - 1];
      if (next) {
        this.activate(next.id);
      } else {
        // No tabs left — create a blank one
        const blank = this.create();
        this.activate(blank.id);
      }
    }

    renderTabs();
    saveSessionState();
    return true;
  },

  closeAll(force = false) {
    const ids = this.tabs.map(t => t.id);
    for (const id of ids) this.close(id, force);
  },
};

// ═══════════════════════════════════════════════════════════════
//  RENDER TABS
// ═══════════════════════════════════════════════════════════════
function renderTabs() {
  const list = document.getElementById("tabs-list");
  if (!list) return;
  list.innerHTML = "";

  TabManager.tabs.forEach((tab) => {
    const el = document.createElement("div");
    el.className = "tab-item" + (tab.id === TabManager.activeId ? " active" : "");
    el.dataset.id = tab.id;
    el.title = tab.filePath || tab.title;

    if (tab.isModified) {
      const dot = document.createElement("span");
      dot.className = "tab-modified-dot";
      dot.textContent = "●";
      el.appendChild(dot);
    }

    const label = document.createElement("span");
    label.className = "tab-label";
    label.textContent = tab.title;
    el.appendChild(label);

    const closeBtn = document.createElement("button");
    closeBtn.className = "tab-close";
    closeBtn.textContent = "×";
    closeBtn.title = "Close tab";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      TabManager.close(tab.id);
    });
    el.appendChild(closeBtn);

    // Left-click → activate
    el.addEventListener("click", () => TabManager.activate(tab.id));

    // Middle-click → close
    el.addEventListener("mousedown", (e) => {
      if (e.button === 1) { e.preventDefault(); TabManager.close(tab.id); }
    });

    list.appendChild(el);
  });

  // Scroll active tab into view
  const activeEl = list.querySelector(".tab-item.active");
  if (activeEl) activeEl.scrollIntoView({ block: "nearest", inline: "nearest" });
}

// ═══════════════════════════════════════════════════════════════
//  STATUS BAR HELPERS
// ═══════════════════════════════════════════════════════════════
function updateStatusBar() {
  const tab = TabManager.getActive();
  const lang = tab ? tab.language : "plaintext";

  const langEl = document.getElementById("language");
  if (langEl) langEl.textContent = getLangDisplay(lang);

  const fileEl = document.getElementById("fileStatus");
  if (fileEl) fileEl.textContent = tab ? tab.title : "Untitled";
}

function updateZoomStatus() {
  const el = document.getElementById("zoomStatus");
  if (el) el.textContent = `${Math.round((editorFontSize / 18) * 100)}%`;
}
function updateWrapStatus() {
  const el = document.getElementById("wrapStatus");
  if (el) el.textContent = wordWrapEnabled ? "Wrap ON" : "Wrap OFF";
}

let _countTimer = null;
function updateCounts() {
  clearTimeout(_countTimer);
  _countTimer = setTimeout(() => {
    if (!window.editor) return;
    const text  = window.editor.getValue();
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const el    = (id) => document.getElementById(id);
    if (el("wordCount")) el("wordCount").textContent = `Words: ${words}`;
    if (el("charCount")) el("charCount").textContent = `Chars: ${text.length}`;
    if (el("lineCount")) el("lineCount").textContent =
      `Lines: ${window.editor.getModel()?.getLineCount() || 0}`;
  }, 150);
}

function updateTitleBar() {
  const tab  = TabManager.getActive();
  const name = tab ? tab.title : "Untitled";
  const modified = tab ? tab.isModified : false;

  const titleEl = document.getElementById("titleFileName");
  const dotEl   = document.getElementById("modifiedDot");
  if (titleEl) titleEl.textContent = name + " — Noter";
  if (dotEl)   dotEl.style.display = modified ? "inline" : "none";
}

// ═══════════════════════════════════════════════════════════════
//  SIDEBAR / EXPLORER
// ═══════════════════════════════════════════════════════════════
const explorerState = {
  rootPath:      null,
  expandedPaths: new Set(),
};

function toggleSidebar(force) {
  sidebarVisible = (force !== undefined) ? force : !sidebarVisible;

  const sidebar = document.getElementById("sidebar");
  const handle  = document.getElementById("resize-handle");
  const btn     = document.getElementById("sidebar-toggle");

  if (sidebarVisible) {
    sidebar.classList.remove("hidden");
    sidebar.style.width = sidebarWidth + "px";
    if (handle) handle.style.display = "";
  } else {
    sidebar.classList.add("hidden");
    if (handle) handle.style.display = "none";
  }

  if (btn) btn.classList.toggle("active", sidebarVisible);
  saveSessionState();
}

async function openExplorerFolder(folderPath) {
  if (!folderPath) return;
  explorerState.rootPath = folderPath;

  document.getElementById("no-folder-msg").style.display   = "none";
  const content = document.getElementById("explorer-content");
  content.style.display = "flex";

  const nameEl = document.getElementById("folder-name");
  if (nameEl) nameEl.textContent = basename(folderPath).toUpperCase();

  const tree = document.getElementById("explorer-tree");
  tree.innerHTML = "";
  await loadExplorerChildren(folderPath, tree, 0);

  // Auto-show sidebar
  if (!sidebarVisible) toggleSidebar(true);

  // Sync terminal cwd with opened folder
  if (typeof TerminalPanel !== "undefined") TerminalPanel.setCwd(folderPath);

  saveSessionState();
}

async function refreshExplorer() {
  if (!explorerState.rootPath) return;
  const tree = document.getElementById("explorer-tree");
  tree.innerHTML = "";
  await loadExplorerChildren(explorerState.rootPath, tree, 0);
}

async function loadExplorerChildren(dirPath, container, depth) {
  container.innerHTML =
    `<div class="explorer-row" style="padding-left:${depth * 16 + 24}px">
       <span style="color:var(--overlay0);font-size:11px">Loading…</span>
     </div>`;

  const entries = await window.electronAPI.readDirectory(dirPath);
  container.innerHTML = "";

  if (!entries) {
    container.innerHTML =
      `<div class="explorer-row" style="padding-left:${depth * 16 + 24}px">
         <span style="color:var(--red);font-size:11px">Cannot read folder</span>
       </div>`;
    return;
  }

  for (const entry of entries) {
    container.appendChild(createExplorerItem(entry, depth));
  }
}

function createExplorerItem(entry, depth) {
  const wrapper = document.createElement("div");

  if (entry.type === "directory") {
    // ── Directory row ──────────────────────────────
    const row = document.createElement("div");
    row.className = "explorer-row";
    row.dataset.path = entry.path;
    row.innerHTML =
      `<span class="explorer-indent" style="width:${depth * 16 + 6}px"></span>` +
      `<span class="explorer-toggle">▶</span>` +
      `<span class="explorer-file-icon" style="color:var(--yellow)">📁</span>` +
      `<span class="explorer-name">${entry.name}</span>`;

    const childrenContainer = document.createElement("div");

    const isExpanded = explorerState.expandedPaths.has(entry.path);
    if (isExpanded) {
      row.querySelector(".explorer-toggle").classList.add("open");
      row.querySelector(".explorer-file-icon").textContent = "📂";
      loadExplorerChildren(entry.path, childrenContainer, depth + 1);
    }

    row.addEventListener("click", async () => {
      const open = row.querySelector(".explorer-toggle").classList.contains("open");
      if (open) {
        row.querySelector(".explorer-toggle").classList.remove("open");
        row.querySelector(".explorer-file-icon").textContent = "📁";
        childrenContainer.innerHTML = "";
        explorerState.expandedPaths.delete(entry.path);
      } else {
        row.querySelector(".explorer-toggle").classList.add("open");
        row.querySelector(".explorer-file-icon").textContent = "📂";
        explorerState.expandedPaths.add(entry.path);
        await loadExplorerChildren(entry.path, childrenContainer, depth + 1);
      }
    });

    wrapper.appendChild(row);
    wrapper.appendChild(childrenContainer);

  } else {
    // ── File row ───────────────────────────────────
    const color = getFileColor(entry.name);
    const row   = document.createElement("div");
    row.className = "explorer-row";
    row.dataset.path = entry.path;
    row.innerHTML =
      `<span class="explorer-indent" style="width:${depth * 16 + 22}px"></span>` +
      `<span class="explorer-file-icon" style="color:${color}">◦</span>` +
      `<span class="explorer-name" style="color:${color}">${entry.name}</span>`;

    row.addEventListener("click", () => openFileFromExplorer(entry.path));
    wrapper.appendChild(row);
  }

  return wrapper;
}

async function openFileFromExplorer(filePath) {
  // If already open in a tab — just switch
  const existing = TabManager.tabs.find(t => t.filePath === filePath);
  if (existing) {
    TabManager.activate(existing.id);
    return;
  }

  const file = await window.electronAPI.openFileByPath(filePath);
  if (!file) {
    showToast("Could not open: " + basename(filePath), "error");
    return;
  }

  const lang = getLang(filePath);
  const tab  = TabManager.create(filePath, file.content, lang);
  TabManager.activate(tab.id);
  addToRecentFiles(filePath);
}

function updateExplorerActiveFile() {
  const activePath = TabManager.getActive()?.filePath;
  document.querySelectorAll(".explorer-row[data-path]").forEach((row) => {
    row.classList.toggle("active-file", row.dataset.path === activePath);
  });
}

// ═══════════════════════════════════════════════════════════════
//  SIDEBAR RESIZE (drag handle)
// ═══════════════════════════════════════════════════════════════
(function initResizeHandle() {
  const handle  = document.getElementById("resize-handle");
  const sidebar = document.getElementById("sidebar");
  let dragging  = false, startX = 0, startW = 0;

  handle.addEventListener("mousedown", (e) => {
    dragging = true;
    startX   = e.clientX;
    startW   = sidebar.offsetWidth;
    handle.classList.add("dragging");
    document.body.style.userSelect = "none";
    document.body.style.cursor     = "col-resize";

    const onMove = (e) => {
      if (!dragging) return;
      const w = Math.min(Math.max(startW + (e.clientX - startX), 150), 520);
      sidebarWidth = w;
      sidebar.style.width = w + "px";
    };
    const onUp = () => {
      dragging = false;
      handle.classList.remove("dragging");
      document.body.style.userSelect = "";
      document.body.style.cursor     = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
      saveSessionState();
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
    e.preventDefault();
  });
})();

// ═══════════════════════════════════════════════════════════════
//  RECENT FILES  (localStorage)
// ═══════════════════════════════════════════════════════════════
function getRecentFiles() {
  try { return JSON.parse(localStorage.getItem("recentFiles") || "[]"); }
  catch { return []; }
}

function addToRecentFiles(filePath) {
  let list = getRecentFiles();
  list = [filePath, ...list.filter(f => f !== filePath)].slice(0, 10);
  localStorage.setItem("recentFiles", JSON.stringify(list));
  renderRecentFiles();
}

function renderRecentFiles() {
  const submenu = document.getElementById("recentFilesSubmenu");
  if (!submenu) return;
  submenu.innerHTML = "";

  const list = getRecentFiles();
  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "menu-option disabled";
    empty.textContent = "No recent files";
    submenu.appendChild(empty);
  } else {
    list.forEach((fp) => {
      const item = document.createElement("div");
      item.className = "menu-option";
      item.textContent = basename(fp);
      item.title = fp;
      item.addEventListener("click", async (e) => {
        e.stopPropagation();
        await openFileByPath(fp);
        closeAllMenus();
      });
      submenu.appendChild(item);
    });
    const sep = document.createElement("div");
    sep.className = "separator";
    submenu.appendChild(sep);
  }

  const clearBtn = document.createElement("div");
  clearBtn.className = "menu-option";
  clearBtn.textContent = "Clear Recent";
  clearBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    localStorage.removeItem("recentFiles");
    renderRecentFiles();
    closeAllMenus();
  });
  submenu.appendChild(clearBtn);
}

async function openFileByPath(fp) {
  const existing = TabManager.tabs.find(t => t.filePath === fp);
  if (existing) { TabManager.activate(existing.id); return; }

  const file = await window.electronAPI.openFileByPath(fp);
  if (!file) { showToast("Could not open: " + basename(fp), "error"); return; }

  const lang = getLang(fp);
  const tab  = TabManager.create(fp, file.content, lang);
  TabManager.activate(tab.id);
  addToRecentFiles(fp);
}

// ═══════════════════════════════════════════════════════════════
//  SESSION STATE  (localStorage — auto-saved on every change)
// ═══════════════════════════════════════════════════════════════
let _sessionTimer = null;
function saveSessionState() {
  clearTimeout(_sessionTimer);
  _sessionTimer = setTimeout(() => {
    const state = {
      explorerPath:    explorerState.rootPath,
      expandedPaths:   [...explorerState.expandedPaths],
      sidebarVisible,
      sidebarWidth,
      fontSize:        editorFontSize,
      wordWrap:        wordWrapEnabled,
      tabs: TabManager.tabs.map(t => ({
        filePath: t.filePath,
        isActive: t.id === TabManager.activeId,
      })),
    };
    localStorage.setItem("noterSession", JSON.stringify(state));
  }, 500);
}

async function restoreSessionState() {
  try {
    const raw = localStorage.getItem("noterSession");
    if (!raw) return false;
    const s = JSON.parse(raw);

    // Settings
    sidebarVisible  = s.sidebarVisible  ?? true;
    sidebarWidth    = s.sidebarWidth    ?? 220;
    editorFontSize  = s.fontSize        ?? 18;
    wordWrapEnabled = s.wordWrap        ?? true;

    // Apply sidebar state immediately (before Monaco)
    const sidebar = document.getElementById("sidebar");
    const handle  = document.getElementById("resize-handle");
    const btn     = document.getElementById("sidebar-toggle");
    if (!sidebarVisible) {
      sidebar.classList.add("hidden");
      if (handle) handle.style.display = "none";
    } else {
      sidebar.style.width = sidebarWidth + "px";
    }
    if (btn) btn.classList.toggle("active", sidebarVisible);

    // Restore explorer folder
    if (s.explorerPath) {
      explorerState.expandedPaths = new Set(s.expandedPaths || []);
      await openExplorerFolder(s.explorerPath);
    }

    // Restore tabs
    let restoredAny = false;
    if (Array.isArray(s.tabs) && s.tabs.length > 0) {
      for (const t of s.tabs) {
        if (t.filePath) {
          const file = await window.electronAPI.openFileByPath(t.filePath);
          if (file) {
            const tab = TabManager.create(file.filePath, file.content, getLang(file.filePath));
            if (t.isActive) { TabManager.activate(tab.id); restoredAny = true; }
          }
        } else {
          const tab = TabManager.create();
          if (t.isActive) { TabManager.activate(tab.id); restoredAny = true; }
        }
      }
      // Activate first tab if none was marked active
      if (!restoredAny && TabManager.tabs.length > 0) {
        TabManager.activate(TabManager.tabs[0].id);
      }
    }

    return TabManager.tabs.length > 0;
  } catch (err) {
    console.warn("Session restore failed:", err);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
//  WORKSPACE  (create / save / open .noterws files)
// ═══════════════════════════════════════════════════════════════

async function createWorkspace() {
  // ── 1. Warn if any tab has unsaved changes ──────────────────
  const dirty = TabManager.tabs.filter(t => t.isModified);
  if (dirty.length > 0) {
    const names = dirty.map(t => t.title).join(", ");
    if (!confirm(`Unsaved changes in: ${names}\n\nCreate a new workspace anyway?`)) {
      closeAllMenus(); return;
    }
  }

  closeAllMenus();

  // ── 2. Wipe current state ───────────────────────────────────
  TabManager.closeAll(true);

  explorerState.rootPath = null;
  explorerState.expandedPaths = new Set();

  const noFolderMsg    = document.getElementById("no-folder-msg");
  const explorerContent = document.getElementById("explorer-content");
  const explorerTree   = document.getElementById("explorer-tree");
  const folderNameEl   = document.getElementById("folder-name");

  if (noFolderMsg)    noFolderMsg.style.display    = "";
  if (explorerContent) explorerContent.style.display = "none";
  if (explorerTree)   explorerTree.innerHTML        = "";
  if (folderNameEl)   folderNameEl.textContent      = "";

  // Make sure sidebar is visible for the new workspace
  if (!sidebarVisible) toggleSidebar(true);

  // ── 3. Pick a root folder for the workspace ─────────────────
  const folderPath = await window.electronAPI.openFolder();
  if (folderPath) await openExplorerFolder(folderPath);

  // ── 4. Start with a blank tab ────────────────────────────────
  const tab = TabManager.create();
  TabManager.activate(tab.id);

  // ── 5. Save the workspace file ───────────────────────────────
  const wsData = {
    version:      1,
    explorerPath: explorerState.rootPath,
    tabs:         [],
    settings:     { fontSize: editorFontSize, wordWrap: wordWrapEnabled },
  };

  const wsPath = await window.electronAPI.saveWorkspace(wsData);

  if (wsPath) {
    showToast("Workspace created: " + basename(wsPath), "success");
  } else {
    // User cancelled the save dialog — workspace is still active in memory
    showToast("New workspace ready", "info");
  }

  window.editor?.focus();
}

async function saveWorkspace() {
  const data = {
    version:      1,
    explorerPath: explorerState.rootPath,
    tabs: TabManager.tabs.map(t => ({
      filePath: t.filePath,
      isActive: t.id === TabManager.activeId,
    })),
    settings: { fontSize: editorFontSize, wordWrap: wordWrapEnabled },
  };

  const wsPath = await window.electronAPI.saveWorkspace(data);
  if (wsPath) showToast("Workspace saved: " + basename(wsPath), "success");
  else        showToast("Workspace save cancelled", "info");
  closeAllMenus();
}

async function openWorkspace() {
  const data = await window.electronAPI.openWorkspace();
  if (!data) { closeAllMenus(); return; }

  // Close all current tabs
  TabManager.closeAll(true);

  // Apply settings
  if (data.settings) {
    if (data.settings.fontSize) {
      editorFontSize = data.settings.fontSize;
      window.editor?.updateOptions({ fontSize: editorFontSize });
      updateZoomStatus();
    }
    if (data.settings.wordWrap !== undefined) {
      wordWrapEnabled = data.settings.wordWrap;
      window.editor?.updateOptions({ wordWrap: wordWrapEnabled ? "on" : "off" });
      updateWrapStatus();
    }
  }

  // Restore explorer
  if (data.explorerPath) await openExplorerFolder(data.explorerPath);

  // Restore tabs
  let anyActive = false;
  if (Array.isArray(data.tabs)) {
    for (const t of data.tabs) {
      if (t.filePath) {
        const file = await window.electronAPI.openFileByPath(t.filePath);
        if (file) {
          const tab = TabManager.create(file.filePath, file.content, getLang(file.filePath));
          if (t.isActive) { TabManager.activate(tab.id); anyActive = true; }
        }
      } else {
        const tab = TabManager.create();
        if (t.isActive) { TabManager.activate(tab.id); anyActive = true; }
      }
    }
  }

  if (!anyActive) {
    if (TabManager.tabs.length > 0) TabManager.activate(TabManager.tabs[0].id);
    else { const t = TabManager.create(); TabManager.activate(t.id); }
  }

  renderTabs();
  showToast("Workspace loaded", "success");
  closeAllMenus();
}

// ═══════════════════════════════════════════════════════════════
//  MENU SYSTEM
// ═══════════════════════════════════════════════════════════════
const closeAllMenus = () =>
  document.querySelectorAll(".dropdown").forEach(d => d.classList.remove("active"));

document.querySelectorAll(".menu-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.stopPropagation();
    const dropdown = item.querySelector(".dropdown");
    const wasOpen  = dropdown.classList.contains("active");
    closeAllMenus();
    if (!wasOpen) dropdown.classList.add("active");
  });
});

document.addEventListener("click", closeAllMenus);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAllMenus(); });

// ═══════════════════════════════════════════════════════════════
//  ACTIONS
// ═══════════════════════════════════════════════════════════════
const actions = {

  // ── File ──────────────────────────────────────────────────────
  newFile() {
    if (!window.editor) return;
    const tab = TabManager.create();
    TabManager.activate(tab.id);
    window.editor.updateOptions({ fontSize: editorFontSize });
    closeAllMenus();
  },

  async openFile() {
    if (!window.editor) return;
    const file = await window.electronAPI.openFile();
    if (!file) return;

    // Check if already open
    const existing = TabManager.tabs.find(t => t.filePath === file.filePath);
    if (existing) { TabManager.activate(existing.id); closeAllMenus(); return; }

    const lang = getLang(file.filePath);
    const tab  = TabManager.create(file.filePath, file.content, lang);
    TabManager.activate(tab.id);
    addToRecentFiles(file.filePath);
    closeAllMenus();
  },

  async openFolder() {
    const folderPath = await window.electronAPI.openFolder();
    if (folderPath) await openExplorerFolder(folderPath);
    closeAllMenus();
  },

  async saveFile() {
    if (!window.editor) return;
    const tab = TabManager.getActive();
    if (!tab) return;
    if (!tab.filePath) return actions.saveAsFile();

    const ok = await window.electronAPI.saveFile({
      path:    tab.filePath,
      content: window.editor.getValue(),
    });
    if (ok) {
      tab.isModified = false;
      renderTabs();
      updateTitleBar();
      showToast("Saved: " + tab.title, "success");
    } else {
      showToast("Save failed!", "error");
    }
    closeAllMenus();
    window.editor.focus();
  },

  async saveAsFile() {
    if (!window.editor) return;
    const tab = TabManager.getActive();
    if (!tab) return;

    const newPath = await window.electronAPI.saveAsFile(window.editor.getValue());
    if (!newPath) return;

    tab.filePath   = newPath;
    tab.title      = basename(newPath);
    tab.language   = getLang(newPath);
    tab.isModified = false;

    monaco.editor.setModelLanguage(tab.model, tab.language);
    updateStatusBar();
    updateTitleBar();
    renderTabs();
    addToRecentFiles(newPath);
    showToast("Saved as: " + tab.title, "success");
    closeAllMenus();
    window.editor.focus();
  },

  // ── Edit ──────────────────────────────────────────────────────
  undo()      { window.editor?.trigger("kbd","undo",null);                                  window.editor?.focus(); },
  redo()      { window.editor?.trigger("kbd","redo",null);                                  window.editor?.focus(); },
  cut()       { window.editor?.trigger("kbd","editor.action.clipboardCutAction",null);      window.editor?.focus(); },
  copy()      { window.editor?.trigger("kbd","editor.action.clipboardCopyAction",null);     window.editor?.focus(); },
  paste()     { window.editor?.trigger("kbd","editor.action.clipboardPasteAction",null);    window.editor?.focus(); },
  selectAll() {
    if (!window.editor) return;
    window.editor.setSelection(window.editor.getModel().getFullModelRange());
    window.editor.focus();
  },

  duplicateLine() {
    if (!window.editor) return;
    const model    = window.editor.getModel();
    const pos      = window.editor.getPosition();
    const lineNum  = pos.lineNumber;
    const lineText = model.getLineContent(lineNum);
    const maxCol   = model.getLineMaxColumn(lineNum);
    window.editor.pushUndoStop();
    window.editor.executeEdits("dup-line", [{
      range: { startLineNumber: lineNum, startColumn: maxCol,
               endLineNumber:   lineNum, endColumn:   maxCol },
      text: "\n" + lineText,
    }]);
    window.editor.pushUndoStop();
    window.editor.setPosition({ lineNumber: lineNum + 1, column: pos.column });
    window.editor.focus();
  },

  find()    { window.editor?.trigger("kbd","actions.find",null);                       closeAllMenus(); },
  replace() { window.editor?.trigger("kbd","editor.action.startFindReplaceAction",null); closeAllMenus(); },

  // ── View ──────────────────────────────────────────────────────
  zoomIn()  {
    editorFontSize = Math.min(editorFontSize + 2, 48);
    window.editor?.updateOptions({ fontSize: editorFontSize });
    updateZoomStatus(); closeAllMenus();
  },
  zoomOut() {
    editorFontSize = Math.max(editorFontSize - 2, 8);
    window.editor?.updateOptions({ fontSize: editorFontSize });
    updateZoomStatus(); closeAllMenus();
  },
  resetZoom() {
    editorFontSize = 18;
    window.editor?.updateOptions({ fontSize: 18 });
    updateZoomStatus(); closeAllMenus();
  },
  toggleWordWrap() {
    wordWrapEnabled = !wordWrapEnabled;
    window.editor?.updateOptions({ wordWrap: wordWrapEnabled ? "on" : "off" });
    updateWrapStatus(); closeAllMenus();
  },
  toggleExplorer() { toggleSidebar(); closeAllMenus(); },
};

// ═══════════════════════════════════════════════════════════════
//  EVENT LISTENERS (menus + buttons)
// ═══════════════════════════════════════════════════════════════

// ── File ────────────────────────────────────────────────────────
document.getElementById("newFile")        .addEventListener("click", () => actions.newFile());
document.getElementById("newTab")         .addEventListener("click", () => actions.newFile());
document.getElementById("openFile")       .addEventListener("click", () => actions.openFile());
document.getElementById("openFolder")     .addEventListener("click", () => actions.openFolder());
document.getElementById("saveFile")       .addEventListener("click", () => actions.saveFile());
document.getElementById("saveAsFile")     .addEventListener("click", () => actions.saveAsFile());
document.getElementById("createWorkspace").addEventListener("click", () => createWorkspace());
document.getElementById("saveWorkspace")  .addEventListener("click", () => saveWorkspace());
document.getElementById("openWorkspace")  .addEventListener("click", () => openWorkspace());
document.getElementById("quitApp")        .addEventListener("click", () => window.electronAPI.quit());

// ── Edit ────────────────────────────────────────────────────────
document.getElementById("undoAction")         .addEventListener("click", () => { actions.undo();          closeAllMenus(); });
document.getElementById("redoAction")         .addEventListener("click", () => { actions.redo();          closeAllMenus(); });
document.getElementById("cutAction")          .addEventListener("click", () => { actions.cut();           closeAllMenus(); });
document.getElementById("copyAction")         .addEventListener("click", () => { actions.copy();          closeAllMenus(); });
document.getElementById("pasteAction")        .addEventListener("click", () => { actions.paste();         closeAllMenus(); });
document.getElementById("selectAllAction")    .addEventListener("click", () => { actions.selectAll();     closeAllMenus(); });
document.getElementById("duplicateLineAction").addEventListener("click", () => { actions.duplicateLine(); closeAllMenus(); });
document.getElementById("findAction")         .addEventListener("click", () => actions.find());
document.getElementById("replaceAction")      .addEventListener("click", () => actions.replace());

// ── View ────────────────────────────────────────────────────────
document.getElementById("toggleExplorerMenu").addEventListener("click", () => actions.toggleExplorer());
document.getElementById("zoomIn")            .addEventListener("click", () => actions.zoomIn());
document.getElementById("zoomOut")           .addEventListener("click", () => actions.zoomOut());
document.getElementById("resetZoom")         .addEventListener("click", () => actions.resetZoom());
document.getElementById("wordWrap")          .addEventListener("click", () => actions.toggleWordWrap());

// ── New feature menu items ───────────────────────────────────────────────────
document.getElementById("toggleTerminalMenu") .addEventListener("click", () => { TerminalPanel.toggle();   closeAllMenus(); });
document.getElementById("toggleSplitMenu")    .addEventListener("click", () => { SplitEditor.toggle();     closeAllMenus(); });
document.getElementById("commandPaletteMenu") .addEventListener("click", () => { CommandPalette.show();    closeAllMenus(); });
document.getElementById("globalSearchMenu")   .addEventListener("click", () => { GlobalSearch.show();      closeAllMenus(); });

// ── Help ────────────────────────────────────────────────────────
document.getElementById("documentation").addEventListener("click", () => {
  window.electronAPI.openExternal("https://github.com/RaviKumar000987/desktop-noter");
  closeAllMenus();
});
document.getElementById("shortcuts").addEventListener("click", () => {
  alert(
    "Keyboard Shortcuts\n\n" +
    "Ctrl + N          →  New File / Tab\n" +
    "Ctrl + T          →  New Tab\n" +
    "Ctrl + W          →  Close Tab\n" +
    "Ctrl + O          →  Open File\n" +
    "Ctrl + S          →  Save\n" +
    "Ctrl + Shift + S  →  Save As\n" +
    "Ctrl + B          →  Toggle Explorer\n" +
    "─────────────────────────────────────\n" +
    "Ctrl + Z          →  Undo\n" +
    "Ctrl + Y          →  Redo\n" +
    "Ctrl + X          →  Cut\n" +
    "Ctrl + C          →  Copy\n" +
    "Ctrl + V          →  Paste\n" +
    "Ctrl + A          →  Select All\n" +
    "Ctrl + D          →  Duplicate Line\n" +
    "─────────────────────────────────────\n" +
    "Ctrl + F          →  Find\n" +
    "Ctrl + H          →  Find & Replace\n" +
    "─────────────────────────────────────\n" +
    "Ctrl + +          →  Zoom In\n" +
    "Ctrl + -          →  Zoom Out\n" +
    "Ctrl + 0          →  Reset Zoom\n" +
    "Esc               →  Close Menu"
  );
  closeAllMenus();
});
document.getElementById("aboutApp").addEventListener("click", () => {
  alert(
    "Noter App\n\n" +
    "Version 2.0.0\n\n" +
    "Features:\n" +
    "  • Multi-Tab Editor\n" +
    "  • Project Explorer\n" +
    "  • Workspace Save/Restore\n" +
    "  • Monaco Editor (VS Code engine)\n\n" +
    "Built with Electron · Monaco\n" +
    "Developer: Ravi Kumar"
  );
  closeAllMenus();
});

// ── Window controls ─────────────────────────────────────────────
document.getElementById("minimize").addEventListener("click", () => window.electronAPI.minimize());
document.getElementById("maximize").addEventListener("click", () => window.electronAPI.maximize());
document.getElementById("close")   .addEventListener("click", () => window.electronAPI.close());

// ── Sidebar controls ────────────────────────────────────────────
document.getElementById("sidebar-toggle")       .addEventListener("click", () => toggleSidebar());
document.getElementById("open-folder-btn")      .addEventListener("click", () => actions.openFolder());
document.getElementById("open-folder-btn2")     .addEventListener("click", () => actions.openFolder());
document.getElementById("refresh-explorer-btn") .addEventListener("click", () => refreshExplorer());

// ── New tab "+" button ──────────────────────────────────────────
document.getElementById("new-tab-btn").addEventListener("click", () => {
  if (window.editor) actions.newFile();
});

// ── Horizontal scroll on tabs with mouse-wheel ──────────────────
document.getElementById("tabs-container").addEventListener("wheel", (e) => {
  e.preventDefault();
  e.currentTarget.scrollLeft += e.deltaY || e.deltaX;
}, { passive: false });

// ─── Global keyboard shortcuts (document level) ─────────────────
document.addEventListener("keydown", (e) => {
  // Ctrl+B → toggle sidebar
  if (e.ctrlKey && !e.shiftKey && e.key === "b") {
    e.preventDefault(); toggleSidebar();
  }
  // Ctrl+N → new file/tab
  if (e.ctrlKey && !e.shiftKey && e.key === "n") {
    e.preventDefault();
    if (window.editor) actions.newFile();
  }
  // Ctrl+T → new tab
  if (e.ctrlKey && !e.shiftKey && e.key === "t") {
    e.preventDefault();
    if (window.editor) actions.newFile();
  }
  // Ctrl+W → close active tab
  if (e.ctrlKey && !e.shiftKey && e.key === "w") {
    e.preventDefault();
    const tab = TabManager.getActive();
    if (tab) TabManager.close(tab.id);
  }
  // Ctrl+O → open file
  if (e.ctrlKey && !e.shiftKey && e.key === "o") {
    e.preventDefault();
    actions.openFile();
  }
  // Ctrl+Shift+S → save as  (check BEFORE plain S)
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") {
    e.preventDefault(); actions.saveAsFile();
  } else if (e.ctrlKey && !e.shiftKey && e.key === "s") {
    e.preventDefault(); actions.saveFile();
  }
  // Ctrl+Tab → next tab
  if (e.ctrlKey && !e.shiftKey && e.key === "Tab") {
    e.preventDefault();
    const idx  = TabManager.tabs.findIndex(t => t.id === TabManager.activeId);
    const next = TabManager.tabs[(idx + 1) % TabManager.tabs.length];
    if (next) TabManager.activate(next.id);
  }
  // Ctrl+Shift+Tab → prev tab
  if (e.ctrlKey && e.shiftKey && e.key === "Tab") {
    e.preventDefault();
    const idx  = TabManager.tabs.findIndex(t => t.id === TabManager.activeId);
    const prev = TabManager.tabs[(idx - 1 + TabManager.tabs.length) % TabManager.tabs.length];
    if (prev) TabManager.activate(prev.id);
  }
});

// ═══════════════════════════════════════════════════════════════
//  MONACO EDITOR INIT
// ═══════════════════════════════════════════════════════════════
require(["vs/editor/editor.main"], async () => {

  // ── Catppuccin Mocha theme ─────────────────────────────────
  monaco.editor.defineTheme("catppuccin-mocha", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "",                     foreground: "cdd6f4", background: "1e1e2e" },
      { token: "comment",              foreground: "585b70", fontStyle: "italic"  },
      { token: "comment.line",         foreground: "585b70", fontStyle: "italic"  },
      { token: "comment.block",        foreground: "585b70", fontStyle: "italic"  },
      { token: "keyword",              foreground: "cba6f7"                       },
      { token: "keyword.operator",     foreground: "89dceb"                       },
      { token: "keyword.control",      foreground: "cba6f7"                       },
      { token: "storage",              foreground: "cba6f7"                       },
      { token: "storage.type",         foreground: "89b4fa"                       },
      { token: "string",               foreground: "a6e3a1"                       },
      { token: "string.escape",        foreground: "f5c2e7"                       },
      { token: "string.template",      foreground: "a6e3a1"                       },
      { token: "number",               foreground: "fab387"                       },
      { token: "regexp",               foreground: "f5c2e7"                       },
      { token: "type",                 foreground: "94e2d5"                       },
      { token: "class",                foreground: "f9e2af"                       },
      { token: "function",             foreground: "89b4fa"                       },
      { token: "variable",             foreground: "cdd6f4"                       },
      { token: "variable.predefined",  foreground: "f38ba8"                       },
      { token: "variable.parameter",   foreground: "fab387", fontStyle: "italic"  },
      { token: "constant",             foreground: "fab387"                       },
      { token: "constant.language",    foreground: "f38ba8"                       },
      { token: "operator",             foreground: "89dceb"                       },
      { token: "delimiter",            foreground: "89dceb"                       },
      { token: "delimiter.bracket",    foreground: "cdd6f4"                       },
      { token: "tag",                  foreground: "f38ba8"                       },
      { token: "attribute.name",       foreground: "f9e2af"                       },
      { token: "attribute.value",      foreground: "a6e3a1"                       },
      { token: "metatag",              foreground: "cba6f7"                       },
      { token: "annotation",           foreground: "f9e2af"                       },
      { token: "decorator",            foreground: "f9e2af"                       },
      { token: "bold",                 fontStyle: "bold"                          },
      { token: "italic",               fontStyle: "italic"                        },
      { token: "heading",              foreground: "89b4fa", fontStyle: "bold"   },
      { token: "link",                 foreground: "94e2d5"                       },
    ],
    colors: {
      "editor.background":                    "#1e1e2e",
      "editor.foreground":                    "#cdd6f4",
      "editor.lineHighlightBackground":       "#313244",
      "editor.lineHighlightBorder":           "#31324400",
      "editorLineNumber.foreground":          "#45475a",
      "editorLineNumber.activeForeground":    "#bac2de",
      "editor.selectionBackground":           "#45475a88",
      "editor.selectionHighlightBackground":  "#45475a44",
      "editor.wordHighlightBackground":       "#45475a55",
      "editorCursor.foreground":              "#f5c2e7",
      "editorCursor.background":              "#1e1e2e",
      "editor.findMatchBackground":           "#f9e2af44",
      "editor.findMatchHighlightBackground":  "#f9e2af22",
      "editor.findMatchBorder":               "#f9e2af88",
      "editorWidget.background":              "#181825",
      "editorWidget.border":                  "#313244",
      "editorWidget.foreground":              "#cdd6f4",
      "input.background":                     "#313244",
      "input.foreground":                     "#cdd6f4",
      "input.border":                         "#45475a",
      "inputOption.activeBorder":             "#cba6f7",
      "inputOption.activeBackground":         "#cba6f722",
      "inputOption.activeForeground":         "#cdd6f4",
      "list.activeSelectionBackground":       "#313244",
      "list.activeSelectionForeground":       "#cdd6f4",
      "list.hoverBackground":                 "#28283d",
      "editorGutter.background":              "#1e1e2e",
      "editorIndentGuide.background":         "#313244",
      "editorIndentGuide.activeBackground":   "#45475a",
      "editorBracketMatch.background":        "#45475a55",
      "editorBracketMatch.border":            "#94e2d5",
      "minimap.background":                   "#1e1e2e",
      "minimap.selectionHighlight":           "#45475a88",
      "minimapSlider.background":             "#45475a44",
      "minimapSlider.hoverBackground":        "#585b7066",
      "minimapSlider.activeBackground":       "#7f849c66",
      "scrollbar.shadow":                     "#00000000",
      "scrollbarSlider.background":           "#45475a55",
      "scrollbarSlider.hoverBackground":      "#585b7088",
      "scrollbarSlider.activeBackground":     "#7f849c88",
      "editorOverviewRuler.border":           "#00000000",
      "editorOverviewRuler.findMatchForeground": "#f9e2af88",
      "peekViewEditor.background":            "#181825",
      "peekViewResult.background":            "#11111b",
      "peekViewTitle.background":             "#181825",
      "peekViewResult.selectionBackground":   "#313244",
      "focusBorder":                          "#cba6f755",
      "badge.background":                     "#313244",
      "badge.foreground":                     "#cdd6f4",
    },
  });

  // ── Create editor (no model yet — tabs will supply models) ──
  window.editor = monaco.editor.create(document.getElementById("editor"), {
    model:         null,            // start modelless; first tab sets it
    theme:         "catppuccin-mocha",
    automaticLayout: true,
    fontSize:        editorFontSize,
    fontFamily:      "'Dank Mono','Cascadia Code','Fira Code',Consolas,'Courier New',monospace",
    lineHeight:      38,
    padding:         { top: 20, bottom: 20 },
    minimap:         { enabled: true },
    wordWrap:        wordWrapEnabled ? "on" : "off",
    smoothScrolling: true,
    overviewRulerBorder: false,
    renderLineHighlight: "all",
    cursorBlinking:  "smooth",
    cursorSmoothCaretAnimation: "on",
    roundedSelection: true,
  });

  // ── Register shortcuts inside Monaco ────────────────────────
  window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
    () => actions.saveFile());
  window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS,
    () => actions.saveAsFile());
  window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyN,
    () => actions.newFile());
  window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyT,
    () => actions.newFile());
  window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW,
    () => { const t = TabManager.getActive(); if (t) TabManager.close(t.id); });
  window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyO,
    () => actions.openFile());
  window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD,
    () => actions.duplicateLine());
  window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB,
    () => toggleSidebar());

  // Tab navigation inside Monaco
  window.editor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyCode.Tab, () => {
      const idx  = TabManager.tabs.findIndex(t => t.id === TabManager.activeId);
      const next = TabManager.tabs[(idx + 1) % TabManager.tabs.length];
      if (next) TabManager.activate(next.id);
    });
  window.editor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Tab, () => {
      const idx  = TabManager.tabs.findIndex(t => t.id === TabManager.activeId);
      const len  = TabManager.tabs.length;
      const prev = TabManager.tabs[(idx - 1 + len) % len];
      if (prev) TabManager.activate(prev.id);
    });

  // ── Editor event listeners ───────────────────────────────────
  let _rafCursor = null;
  window.editor.onDidChangeCursorPosition((e) => {
    cancelAnimationFrame(_rafCursor);
    _rafCursor = requestAnimationFrame(() => {
      const el = document.getElementById("cursorPosition");
      if (el) el.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
    });
  });

  // ── Init: try session restore, else blank tab ────────────────
  const restored = await restoreSessionState();
  if (!restored) {
    const tab = TabManager.create();
    TabManager.activate(tab.id);
  }

  // Apply persisted settings to editor
  window.editor.updateOptions({
    fontSize: editorFontSize,
    wordWrap: wordWrapEnabled ? "on" : "off",
  });

  // Init all status displays
  updateZoomStatus();
  updateWrapStatus();
  updateStatusBar();
  updateTitleBar();
  updateCounts();
  renderRecentFiles();

  window.editor.focus();

  // Notify feature modules that Monaco is ready so they can register addCommand shortcuts
  document.dispatchEvent(new CustomEvent("monaco-ready"));
});

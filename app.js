// ═══════════════════════════════════════════════════════════════
//  NOTER APP — app.js  (complete rewrite, no duplicate listeners)
// ═══════════════════════════════════════════════════════════════

// ─── State ──────────────────────────────────────────────────────
let currentFilePath = null;
let editorFontSize = 18;
let wordWrapEnabled = true;
let isModified = false;

// ─── Monaco Loader ──────────────────────────────────────────────
require.config({ paths: { vs: "./node_modules/monaco-editor/min/vs" } });

// ─── Language Detection ─────────────────────────────────────────
const EXT_TO_LANG = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  jsx: "javascript",
  tsx: "typescript",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  less: "less",
  json: "json",
  jsonc: "json",
  md: "markdown",
  markdown: "markdown",
  py: "python",
  rb: "ruby",
  php: "php",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cs: "csharp",
  go: "go",
  rs: "rust",
  sh: "shell",
  bash: "shell",
  xml: "xml",
  svg: "xml",
  yaml: "yaml",
  yml: "yaml",
  sql: "sql",
  txt: "plaintext",
};

const LANG_DISPLAY = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  less: "LESS",
  json: "JSON",
  markdown: "Markdown",
  python: "Python",
  ruby: "Ruby",
  php: "PHP",
  java: "Java",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  go: "Go",
  rust: "Rust",
  shell: "Shell",
  xml: "XML",
  yaml: "YAML",
  sql: "SQL",
  plaintext: "Plain Text",
};

function getLang(filePath) {
  if (!filePath) return "plaintext";
  const ext = filePath.split(".").pop().toLowerCase();
  return EXT_TO_LANG[ext] || "plaintext";
}
function getLangDisplay(lang) {
  return LANG_DISPLAY[lang] || lang;
}

// ─── Recent Files (localStorage) ────────────────────────────────
function getRecentFiles() {
  try {
    return JSON.parse(localStorage.getItem("recentFiles") || "[]");
  } catch {
    return [];
  }
}

function addToRecentFiles(filePath) {
  let list = getRecentFiles();
  list = [filePath, ...list.filter((f) => f !== filePath)].slice(0, 8);
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
      item.textContent = fp.split("\\").pop();
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
  if (isModified && !confirm("Unsaved changes will be lost. Continue?")) return;
  const file = await window.electronAPI.openFileByPath(fp);
  if (!file) {
    alert("Could not open:\n" + fp);
    return;
  }
  currentFilePath = file.filePath;
  window.editor.setValue(file.content);
  isModified = false;
  const lang = getLang(currentFilePath);
  monaco.editor.setModelLanguage(window.editor.getModel(), lang);
  updateLanguageStatus(lang);
  updateFileStatus();
  updateTitleBar();
  addToRecentFiles(currentFilePath);
  window.editor.focus();
}

// ─── Status Bar Helpers ─────────────────────────────────────────
function updateZoomStatus() {
  const el = document.getElementById("zoomStatus");
  if (el) el.textContent = `${Math.round((editorFontSize / 18) * 100)}%`;
}
function updateWrapStatus() {
  const el = document.getElementById("wrapStatus");
  if (el) el.textContent = wordWrapEnabled ? "Wrap ON" : "Wrap OFF";
}
function updateFileStatus() {
  const name = currentFilePath ? currentFilePath.split("\\").pop() : "Untitled";
  const el = document.getElementById("fileStatus");
  if (el) el.textContent = name;
}
function updateLanguageStatus(lang) {
  const el = document.getElementById("language");
  if (el) el.textContent = getLangDisplay(lang);
}
function updateTitleBar() {
  const name = currentFilePath ? currentFilePath.split("\\").pop() : "Untitled";
  const titleEl = document.getElementById("titleFileName");
  const dotEl = document.getElementById("modifiedDot");
  if (titleEl) titleEl.textContent = name + " — Noter";
  if (dotEl) dotEl.style.display = isModified ? "inline" : "none";
}

// ─── Menu System ─────────────────────────────────────────────────
const closeAllMenus = () => {
  document
    .querySelectorAll(".dropdown")
    .forEach((d) => d.classList.remove("active"));
};

document.querySelectorAll(".menu-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.stopPropagation();
    const dropdown = item.querySelector(".dropdown");
    const wasOpen = dropdown.classList.contains("active");
    closeAllMenus();
    if (!wasOpen) dropdown.classList.add("active");
  });
});

document.addEventListener("click", closeAllMenus);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAllMenus();
});

// ─── Actions ────────────────────────────────────────────────────
const actions = {
  // ── File ──────────────────────────────────────────────────
  newFile() {
    if (!window.editor) return;
    if (isModified && !confirm("Unsaved changes will be lost. Continue?"))
      return;
    currentFilePath = null;
    isModified = false;
    window.editor.setValue("");
    monaco.editor.setModelLanguage(window.editor.getModel(), "plaintext");
    updateLanguageStatus("plaintext");
    updateFileStatus();
    updateTitleBar();
    closeAllMenus();
    window.editor.focus();
  },

  async openFile() {
    if (isModified && !confirm("Unsaved changes will be lost. Continue?"))
      return;
    const file = await window.electronAPI.openFile();
    if (!file) return;
    currentFilePath = file.filePath;
    window.editor.setValue(file.content);
    isModified = false;
    const lang = getLang(currentFilePath);
    monaco.editor.setModelLanguage(window.editor.getModel(), lang);
    updateLanguageStatus(lang);
    updateFileStatus();
    updateTitleBar();
    addToRecentFiles(currentFilePath);
    closeAllMenus();
    window.editor.focus();
  },

  async saveFile() {
    if (!currentFilePath) return actions.saveAsFile();
    const ok = await window.electronAPI.saveFile({
      path: currentFilePath,
      content: window.editor.getValue(),
    });
    if (ok) {
      isModified = false;
      updateTitleBar();
    }
    closeAllMenus();
    window.editor.focus();
  },

  async saveAsFile() {
    const path = await window.electronAPI.saveAsFile(window.editor.getValue());
    if (!path) return;
    currentFilePath = path;
    isModified = false;
    const lang = getLang(currentFilePath);
    monaco.editor.setModelLanguage(window.editor.getModel(), lang);
    updateLanguageStatus(lang);
    updateFileStatus();
    updateTitleBar();
    addToRecentFiles(currentFilePath);
    closeAllMenus();
    window.editor.focus();
  },

  // ── Edit ──────────────────────────────────────────────────
  undo() {
    window.editor?.trigger("keyboard", "undo", null);
    window.editor?.focus();
  },
  redo() {
    window.editor?.trigger("keyboard", "redo", null);
    window.editor?.focus();
  },
  // Monaco native clipboard actions (proper fix)
  cut() {
    window.editor?.trigger(
      "keyboard",
      "editor.action.clipboardCutAction",
      null,
    );
    window.editor?.focus();
  },
  copy() {
    window.editor?.trigger(
      "keyboard",
      "editor.action.clipboardCopyAction",
      null,
    );
    window.editor?.focus();
  },
  paste() {
    window.editor?.focus();
    document.execCommand("paste");
  },
  selectAll() {
    if (!window.editor) return;
    window.editor.setSelection(window.editor.getModel().getFullModelRange());
    window.editor.focus();
  },

  // ── Find & Replace (Monaco native widgets) ────────────────
  find() {
    window.editor?.trigger("keyboard", "actions.find", null);
    closeAllMenus();
  },
  replace() {
    window.editor?.trigger(
      "keyboard",
      "editor.action.startFindReplaceAction",
      null,
    );
    closeAllMenus();
  },

  // ── Duplicate Line ────────────────────────────────────────
  duplicateLine() {
    if (!window.editor) return;
    const model = window.editor.getModel();
    const position = window.editor.getPosition();
    const lineNum = position.lineNumber;
    const lineText = model.getLineContent(lineNum);
    const maxCol = model.getLineMaxColumn(lineNum);
    // pushUndoStop makes duplicate a single Ctrl+Z step
    window.editor.pushUndoStop();
    window.editor.executeEdits("duplicate-line", [
      {
        range: {
          startLineNumber: lineNum,
          startColumn: maxCol,
          endLineNumber: lineNum,
          endColumn: maxCol,
        },
        text: "\n" + lineText,
      },
    ]);
    window.editor.pushUndoStop();
    window.editor.setPosition({
      lineNumber: lineNum + 1,
      column: position.column,
    });
    window.editor.focus();
  },

  // ── View ──────────────────────────────────────────────────
  zoomIn() {
    editorFontSize = Math.min(editorFontSize + 2, 48);
    window.editor?.updateOptions({ fontSize: editorFontSize });
    updateZoomStatus();
    closeAllMenus();
  },
  zoomOut() {
    editorFontSize = Math.max(editorFontSize - 2, 8);
    window.editor?.updateOptions({ fontSize: editorFontSize });
    updateZoomStatus();
    closeAllMenus();
  },
  resetZoom() {
    editorFontSize = 18;
    window.editor?.updateOptions({ fontSize: 18 });
    updateZoomStatus();
    closeAllMenus();
  },
  toggleWordWrap() {
    wordWrapEnabled = !wordWrapEnabled;
    window.editor?.updateOptions({ wordWrap: wordWrapEnabled ? "on" : "off" });
    updateWrapStatus();
    closeAllMenus();
  },
};

// ─── Menu Item Listeners (ONE per button, no duplicates) ─────────

// File
document
  .getElementById("newFile")
  .addEventListener("click", () => actions.newFile());
document
  .getElementById("openFile")
  .addEventListener("click", () => actions.openFile());
document
  .getElementById("saveFile")
  .addEventListener("click", () => actions.saveFile());
document
  .getElementById("saveAsFile")
  .addEventListener("click", () => actions.saveAsFile());
document
  .getElementById("quitApp")
  .addEventListener("click", () => window.electronAPI.quit());

// Edit
document.getElementById("undoAction").addEventListener("click", () => {
  actions.undo();
  closeAllMenus();
});
document.getElementById("redoAction").addEventListener("click", () => {
  actions.redo();
  closeAllMenus();
});
document.getElementById("cutAction").addEventListener("click", () => {
  actions.cut();
  closeAllMenus();
});
document.getElementById("copyAction").addEventListener("click", () => {
  actions.copy();
  closeAllMenus();
});
document.getElementById("pasteAction").addEventListener("click", () => {
  actions.paste();
  closeAllMenus();
});
document.getElementById("selectAllAction").addEventListener("click", () => {
  actions.selectAll();
  closeAllMenus();
});
document.getElementById("duplicateLineAction").addEventListener("click", () => {
  actions.duplicateLine();
  closeAllMenus();
});
document
  .getElementById("findAction")
  .addEventListener("click", () => actions.find());
document
  .getElementById("replaceAction")
  .addEventListener("click", () => actions.replace());

// View
document
  .getElementById("zoomIn")
  .addEventListener("click", () => actions.zoomIn());
document
  .getElementById("zoomOut")
  .addEventListener("click", () => actions.zoomOut());
document
  .getElementById("resetZoom")
  .addEventListener("click", () => actions.resetZoom());
document
  .getElementById("wordWrap")
  .addEventListener("click", () => actions.toggleWordWrap());

// Help
document.getElementById("documentation").addEventListener("click", () => {
  window.electronAPI.openExternal(
    "https://github.com/RaviKumar000987/desktop-noter",
  );
  closeAllMenus();
});
document.getElementById("shortcuts").addEventListener("click", () => {
  alert(
    "Keyboard Shortcuts\n\n" +
      "Ctrl + N          →  New File\n" +
      "Ctrl + O          →  Open File\n" +
      "Ctrl + S          →  Save\n" +
      "Ctrl + Shift + S  →  Save As\n" +
      "─────────────────────────────\n" +
      "Ctrl + Z          →  Undo\n" +
      "Ctrl + Y          →  Redo\n" +
      "Ctrl + X          →  Cut\n" +
      "Ctrl + C          →  Copy\n" +
      "Ctrl + V          →  Paste\n" +
      "Ctrl + A          →  Select All\n" +
      "Ctrl + D          →  Duplicate Line\n" +
      "─────────────────────────────\n" +
      "Ctrl + F          →  Find\n" +
      "Ctrl + H          →  Find & Replace\n" +
      "─────────────────────────────\n" +
      "Ctrl + +          →  Zoom In\n" +
      "Ctrl + -          →  Zoom Out\n" +
      "Ctrl + 0          →  Reset Zoom\n" +
      "Esc               →  Close Menu",
  );
  closeAllMenus();
});
document.getElementById("aboutApp").addEventListener("click", () => {
  alert(
    "Noter App\n\n" +
      "Version 1.0.0\n\n" +
      "Built with:\n" +
      "  • Electron v42\n" +
      "  • Monaco Editor (VS Code engine)\n" +
      "  • HTML / CSS / JavaScript\n\n" +
      "Developer: Ravi Kumar",
  );
  closeAllMenus();
});

// Window controls
document
  .getElementById("minimize")
  .addEventListener("click", () => window.electronAPI.minimize());
document
  .getElementById("maximize")
  .addEventListener("click", () => window.electronAPI.maximize());
document
  .getElementById("close")
  .addEventListener("click", () => window.electronAPI.close());

// ─── Global Keyboard Shortcuts ──────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && !e.shiftKey && e.key === "n") {
    e.preventDefault();
    actions.newFile();
  }
  if (e.ctrlKey && !e.shiftKey && e.key === "o") {
    e.preventDefault();
    actions.openFile();
  }
  // Check Shift+S BEFORE plain S to avoid conflict
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") {
    e.preventDefault();
    actions.saveAsFile();
  } else if (e.ctrlKey && !e.shiftKey && e.key === "s") {
    e.preventDefault();
    actions.saveFile();
  }
});

// ─── Monaco Editor Init ─────────────────────────────────────────
require(["vs/editor/editor.main"], () => {
  window.editor = monaco.editor.create(document.getElementById("editor"), {
    value: "",
    language: "plaintext",
    theme: "vs-dark",
    automaticLayout: true,
    fontSize: editorFontSize,
    fontFamily:
      "'Dank Mono','Cascadia Code','Fira Code',Consolas,'Courier New',monospace",
    lineHeight: 38,
    padding: { top: 20, bottom: 20 },
    minimap: { enabled: true },
    wordWrap: wordWrapEnabled ? "on" : "off",
    smoothScrolling: true,
    overviewRulerBorder: false,
    renderLineHighlight: "none",
    cursorBlinking: "smooth",
    cursorSmoothCaretAnimation: "on",
    roundedSelection: true,
  });

  // ✅ KEY FIX: register Ctrl+D INSIDE Monaco so it overrides Monaco's
  //    default "Add Selection to Next Find Match" behaviour.
  //    document.addEventListener('keydown') can't intercept Monaco's keys.
  window.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () =>
    actions.duplicateLine(),
  );

  // Live word / char / line count
  const updateCounts = () => {
    const text = window.editor.getValue();
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    document.getElementById("wordCount").textContent = `Words: ${words}`;
    document.getElementById("charCount").textContent = `Chars: ${text.length}`;
    document.getElementById("lineCount").textContent =
      `Lines: ${window.editor.getModel().getLineCount()}`;
  };
  updateCounts();

  // Unsaved-changes tracker → shows ● dot in titlebar
  window.editor.onDidChangeModelContent(() => {
    if (!isModified) {
      isModified = true;
      updateTitleBar();
    }
    updateCounts();
  });

  // Cursor position in status bar
  window.editor.onDidChangeCursorPosition((e) => {
    const el = document.getElementById("cursorPosition");
    if (el)
      el.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
  });

  // Init all displays
  updateZoomStatus();
  updateWrapStatus();
  updateFileStatus();
  updateTitleBar();
  renderRecentFiles();

  window.editor.focus();
});

// ═══════════════════════════════════════════════════════════════
//  SETTINGS FILE MANAGER — settings-file.js  (main process)
//  Manages the user settings.json at:
//    Windows : %APPDATA%/noter/settings.json
//    macOS   : ~/Library/Application Support/noter/settings.json
//    Linux   : ~/.config/noter/settings.json
// ═══════════════════════════════════════════════════════════════
'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ── Settings file path ────────────────────────────────────────
function getNoterDataDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'noter');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'noter');
  }
  return path.join(os.homedir(), '.config', 'noter');
}

const DATA_DIR     = getNoterDataDir();
const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json');

// ── Default settings ──────────────────────────────────────────
const DEFAULTS = {
  // ── Editor ─────────────────────────────────────────────────
  "editor.fontSize":                    14,
  "editor.fontFamily":                  "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
  "editor.fontLigatures":               true,
  "editor.fontWeight":                  "normal",
  "editor.lineHeight":                  28,
  "editor.letterSpacing":               0.3,
  "editor.tabSize":                     4,
  "editor.insertSpaces":                true,
  "editor.detectIndentation":           true,
  "editor.wordWrap":                    "off",
  "editor.wordWrapColumn":              80,
  "editor.lineNumbers":                 "on",
  "editor.rulers":                      [],
  "editor.cursorStyle":                 "line",
  "editor.cursorBlinking":              "smooth",
  "editor.cursorWidth":                 2,
  "editor.smoothScrolling":             true,
  "editor.mouseWheelZoom":              true,
  "editor.scrollBeyondLastLine":        true,

  "editor.minimap.enabled":             true,
  "editor.minimap.autohide":            true,
  "editor.minimap.renderCharacters":    false,
  "editor.minimap.scale":               1,
  "editor.minimap.side":                "right",

  "editor.bracketPairColorization.enabled":  true,
  "editor.guides.indentation":               true,
  "editor.guides.bracketPairs":              true,
  "editor.matchBrackets":                    "always",
  "editor.autoClosingBrackets":              "always",
  "editor.autoClosingQuotes":                "always",
  "editor.autoSurround":                     "languageDefined",

  "editor.stickyScroll.enabled":        true,
  "editor.stickyScroll.maxLineCount":   5,

  "editor.inlayHints.enabled":          "on",
  "editor.parameterHints.enabled":      true,
  "editor.quickSuggestions.other":      true,
  "editor.quickSuggestions.comments":   true,
  "editor.quickSuggestions.strings":    true,
  "editor.quickSuggestionsDelay":       0,
  "editor.suggestOnTriggerCharacters":  true,
  "editor.acceptSuggestionOnEnter":     "on",
  "editor.wordBasedSuggestions":        "allDocuments",
  "editor.tabCompletion":               "on",
  "editor.linkedEditing":               true,

  "editor.renderWhitespace":            "selection",
  "editor.renderLineHighlight":         "all",
  "editor.occurrencesHighlight":        "singleFile",
  "editor.selectionHighlight":          true,
  "editor.overviewRulerBorder":         false,
  "editor.roundedSelection":            true,

  "editor.folding":                     true,
  "editor.foldingHighlight":            true,
  "editor.foldingStrategy":             "auto",
  "editor.showFoldingControls":         "mouseover",

  "editor.formatOnSave":                false,
  "editor.formatOnPaste":               false,
  "editor.formatOnType":                false,
  "editor.trimAutoWhitespace":          true,

  "editor.autoSave":                    "off",
  "editor.autoSaveDelay":               1000,

  "editor.multiCursorModifier":         "ctrlCmd",
  "editor.accessibilitySupport":        "off",

  // ── Terminal ────────────────────────────────────────────────
  "terminal.integrated.fontSize":       13,
  "terminal.integrated.fontFamily":     "'Cascadia Code', 'Fira Code', Consolas, monospace",
  "terminal.integrated.fontWeight":     "normal",
  "terminal.integrated.lineHeight":     1.35,
  "terminal.integrated.letterSpacing":  0,
  "terminal.integrated.cursorStyle":    "block",
  "terminal.integrated.cursorBlink":    true,
  "terminal.integrated.scrollback":     10000,
  "terminal.integrated.copyOnSelection": false,

  // ── Workbench ───────────────────────────────────────────────
  "workbench.colorTheme":               "GitHub Dark",
  "workbench.statusBar.visible":        true,
  "workbench.sideBar.visible":          true,
  "workbench.activityBar.visible":      true,

  // ── Files ───────────────────────────────────────────────────
  "files.autoSave":                     "off",
  "files.autoSaveDelay":                1000,
  "files.encoding":                     "utf8",
  "files.eol":                          "\n",
  "files.trimTrailingWhitespace":       false,
  "files.insertFinalNewline":           false,
  "files.exclude": {
    "**/.git":          true,
    "**/node_modules":  true,
    "**/__pycache__":   true,
    "**/target":        true,
    "**/.DS_Store":     true
  },

  // ── Explorer ────────────────────────────────────────────────
  "explorer.sortOrder":                 "default",
  "explorer.compactFolders":            false,
  "explorer.confirmDelete":             true,
  "explorer.confirmDragAndDrop":        true,

  // ── Search ──────────────────────────────────────────────────
  "search.useIgnoreFiles":              true,
  "search.exclude": {
    "**/node_modules": true,
    "**/.git":         true,
    "**/dist":         true,
    "**/build":        true
  },

  // ── Window ──────────────────────────────────────────────────
  "window.zoomLevel":                   0,
  "window.titleBarStyle":               "custom",

  // ── Git ─────────────────────────────────────────────────────
  "git.enabled":                        true,
  "git.autofetch":                      false,
  "git.confirmSync":                    true
};

// ── File operations ───────────────────────────────────────────

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SETTINGS_PATH)) {
    const content = JSON.stringify(DEFAULTS, null, 2);
    fs.writeFileSync(SETTINGS_PATH, content, 'utf8');
  }
}

function readRaw() {
  try { return fs.readFileSync(SETTINGS_PATH, 'utf8'); }
  catch { return JSON.stringify(DEFAULTS, null, 2); }
}

function readParsed() {
  try {
    const parsed = JSON.parse(readRaw());
    return { ...DEFAULTS, ...parsed };
  } catch { return { ...DEFAULTS }; }
}

function writeRaw(content) {
  try {
    JSON.parse(content); // validate JSON before writing
    fs.writeFileSync(SETTINGS_PATH, content, 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── File watcher ──────────────────────────────────────────────
let _watcher     = null;
let _debounceId  = null;

function startWatching(onChanged) {
  if (_watcher) { try { _watcher.close(); } catch {} }
  _watcher = fs.watch(SETTINGS_PATH, () => {
    clearTimeout(_debounceId);
    _debounceId = setTimeout(() => {
      const settings = readParsed();
      onChanged(settings);
    }, 200);
  });
  _watcher.on('error', () => {}); // ignore watch errors on file replace
}

// ── IPC registration ──────────────────────────────────────────
function registerIPC(ipcMain, mainWindow) {
  ipcMain.handle('settings-json:read-raw',   ()       => readRaw());
  ipcMain.handle('settings-json:read',       ()       => readParsed());
  ipcMain.handle('settings-json:write-raw',  (_, txt) => writeRaw(txt));
  ipcMain.handle('settings-json:get-path',   ()       => SETTINGS_PATH);
  ipcMain.handle('settings-json:get-defaults', ()     => DEFAULTS);

  startWatching((settings) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('settings-json:changed', settings);
    }
  });
}

module.exports = { ensureFile, readParsed, readRaw, writeRaw, registerIPC, SETTINGS_PATH, DEFAULTS };

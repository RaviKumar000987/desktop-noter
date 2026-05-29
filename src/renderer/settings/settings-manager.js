// ═══════════════════════════════════════════════════════════════
//  SETTINGS MANAGER — settings-manager.js
//  Multi-scope: user > workspace > language overrides
//  Named profiles · import/export · change events
//  Load BEFORE app.js and settings-ui.js
// ═══════════════════════════════════════════════════════════════

window.NoterSettings = (() => {
  // ── Scoped stores ─────────────────────────────────────────────
  let _user      = {};
  let _workspace = {};
  let _language  = {}; // { js: { 'editor.tabSize': 2 } }

  // ── Schema (extensions register their settings here) ──────────
  const _schema = {};

  // ── Change listeners ──────────────────────────────────────────
  const _listeners = [];

  // ── Built-in profiles ─────────────────────────────────────────
  const BUILTIN = {
    'Web Development': {
      'editor.tabSize': 2, 'editor.insertSpaces': true, 'editor.wordWrap': 'on',
      'editor.formatOnSave': true, 'editor.fontSize': 16,
      'editor.quickSuggestions': true, 'appearance.colorTheme': 'GitHub Dark',
    },
    'Python': {
      'editor.tabSize': 4, 'editor.insertSpaces': true, 'editor.wordWrap': 'on',
      'editor.formatOnSave': true, 'editor.fontSize': 15,
      'appearance.colorTheme': 'VS Code Dark Modern',
    },
    'C++ / Systems': {
      'editor.tabSize': 4, 'editor.insertSpaces': false, 'editor.wordWrap': 'off',
      'editor.formatOnSave': false, 'editor.fontSize': 14,
      'appearance.colorTheme': 'GitHub Dark Dimmed',
    },
    'Java': {
      'editor.tabSize': 4, 'editor.insertSpaces': true, 'editor.wordWrap': 'on',
      'editor.formatOnSave': true, 'editor.fontSize': 15,
    },
    'Competitive Programming': {
      'editor.tabSize': 4, 'editor.insertSpaces': false, 'editor.wordWrap': 'off',
      'editor.fontSize': 14, 'editor.minimap.enabled': false,
      'editor.lineNumbers': 'on', 'appearance.colorTheme': 'GitHub Dark Dimmed',
    },
    'Minimal': {
      'editor.minimap.enabled': false, 'appearance.showStatusBar': true,
      'editor.lineNumbers': 'on', 'editor.wordWrap': 'on',
      'editor.fontSize': 17, 'editor.cursorBlinking': 'solid',
    },
    'AI Development': {
      'editor.wordWrap': 'on', 'editor.tabSize': 2, 'editor.insertSpaces': true,
      'editor.quickSuggestions': true, 'editor.parameterHints': true,
      'appearance.colorTheme': 'GitHub Dark', 'editor.fontSize': 15,
    },
  };

  let _userProfiles  = {};
  let _activeProfile = null;

  // ── Defaults for all built-in settings ───────────────────────
  const SCHEMA_DEFAULTS = {
    'editor.fontSize': 18, 'editor.fontFamily': 'Cascadia Code, Fira Code, Consolas',
    'editor.lineHeight': 1.5, 'editor.letterSpacing': 0,
    'editor.wordWrap': 'on', 'editor.tabSize': 4, 'editor.insertSpaces': true,
    'editor.formatOnSave': false, 'editor.formatOnPaste': false,
    'editor.trimAutoWhitespace': true, 'editor.detectIndentation': true,
    'editor.cursorStyle': 'line', 'editor.cursorBlinking': 'blink', 'editor.cursorWidth': 2,
    'editor.lineNumbers': 'on', 'editor.minimap.enabled': true,
    'editor.renderWhitespace': 'selection', 'editor.renderLineHighlight': 'all',
    'editor.smoothScrolling': false, 'editor.mouseWheelZoom': false,
    'editor.bracketPairColorization.enabled': true,
    'editor.quickSuggestions': true, 'editor.parameterHints': true,
    'editor.autoClosingBrackets': true, 'editor.autoClosingQuotes': true,
    'editor.suggestOnTriggerCharacters': true,
    'editor.stickyScroll.enabled': false, 'editor.guides.bracketPairs': true,
    'editor.linkedEditing': true, 'editor.occurrencesHighlight': true,
    'editor.selectionHighlight': true, 'editor.codeLens': true,
    'editor.inlineSuggest.enabled': true,
    'terminal.fontSize': 13, 'terminal.fontFamily': 'Cascadia Code, Fira Code, Consolas',
    'terminal.lineHeight': 1.35, 'terminal.shell': '',
    'terminal.cursorBlink': true, 'terminal.cursorStyle': 'block',
    'terminal.scrollback': 5000, 'terminal.copyOnSelection': false,
    'appearance.colorTheme': 'GitHub Dark', 'appearance.iconTheme': 'Default',
    'appearance.sidebarPosition': 'left', 'appearance.showStatusBar': true,
    'appearance.showActivityBar': true, 'appearance.showMinimap': true,
    'appearance.tabCloseButton': 'hover',
    'window.zoomLevel': 0, 'window.restoreState': true,
    'extensions.autoUpdate': true, 'extensions.showRecommendations': true,
    'extensions.installedFirst': false, 'extensions.checkUpdatesOnStartup': true,
    'files.autoSave': 'off', 'files.autoSaveDelay': 1000,
    'files.trimTrailingWS': false, 'files.insertFinalNewline': false,
    'files.excludeNodeModules': true, 'files.excludeGit': true, 'files.sortOrder': 'default',
    'git.enabled': true, 'git.autofetch': false, 'git.confirmSync': true,
    'git.diffAlgorithm': 'default', 'git.showInlineOpen': true,
    'search.exclude': 'node_modules,.git,dist,build', 'search.useIgnoreFiles': true,
    'search.smartCase': false, 'search.maxResults': 400,
  };

  // ── Get ───────────────────────────────────────────────────────
  function get(key, lang = null) {
    if (lang && _language[lang]?.[key] !== undefined) return _language[lang][key];
    if (_workspace[key] !== undefined) return _workspace[key];
    if (_user[key] !== undefined) return _user[key];
    if (SCHEMA_DEFAULTS[key] !== undefined) return SCHEMA_DEFAULTS[key];
    if (_schema[key] !== undefined) return _schema[key].default;
    return undefined;
  }

  // ── Set ───────────────────────────────────────────────────────
  function set(key, value, scope = 'user') {
    const old = get(key);
    if (scope === 'workspace') { _workspace[key] = value; _saveWorkspace(); }
    else                       { _user[key] = value;      _saveUser(); }
    if (old !== value) _emit(key, value, old);
  }

  function setMany(obj, scope = 'user') {
    for (const [k, v] of Object.entries(obj)) set(k, v, scope);
  }

  function reset(key, scope = 'user') {
    if (scope === 'workspace') { delete _workspace[key]; _saveWorkspace(); }
    else                       { delete _user[key];      _saveUser(); }
    _emit(key, get(key), undefined);
  }

  // ── Schema registration ───────────────────────────────────────
  function registerSchema(items) {
    for (const item of items) {
      if (item.key) _schema[item.key] = item;
    }
  }

  // ── Change events ─────────────────────────────────────────────
  function on(keyOrStar, fn)  { _listeners.push({ key: keyOrStar, fn }); }
  function off(keyOrStar, fn) {
    const i = _listeners.findIndex(l => l.key === keyOrStar && l.fn === fn);
    if (i > -1) _listeners.splice(i, 1);
  }
  function _emit(key, val, old) {
    for (const l of _listeners) {
      if (l.key === key || l.key === '*') l.fn(val, old, key);
    }
  }

  // ── Profiles ─────────────────────────────────────────────────
  function getProfiles() { return { ...BUILTIN, ..._userProfiles }; }
  function getActiveProfile() { return _activeProfile; }

  function applyProfile(name) {
    const p = getProfiles()[name];
    if (!p) return false;
    setMany(p, 'user');
    _activeProfile = name;
    try { localStorage.setItem('noter.settings.profile', name); } catch {}
    applyToEditor();
    return true;
  }

  function saveCurrentAsProfile(name) {
    _userProfiles[name] = { ..._user };
    _saveProfiles();
    return true;
  }

  function deleteProfile(name) {
    if (BUILTIN[name]) return false;
    delete _userProfiles[name];
    _saveProfiles();
    return true;
  }

  // ── Export / Import ───────────────────────────────────────────
  function exportSettings() {
    return JSON.stringify({ user: _user, profiles: _userProfiles }, null, 2);
  }

  function importSettings(json) {
    try {
      const obj = JSON.parse(json);
      if (obj.user)     { _user = { ..._user, ...obj.user }; _saveUser(); }
      if (obj.profiles) { _userProfiles = { ..._userProfiles, ...obj.profiles }; _saveProfiles(); }
      applyToEditor();
      return true;
    } catch { return false; }
  }

  // ── Apply current settings to Monaco editor ───────────────────
  function applyToEditor() {
    const ed = window.editor;
    if (!ed || typeof monaco === 'undefined') return;

    const EDITOR_KEYS = [
      'fontSize','fontFamily','lineHeight','letterSpacing',
      'wordWrap','tabSize','insertSpaces','cursorStyle','cursorBlinking','cursorWidth',
      'lineNumbers','renderWhitespace','renderLineHighlight','smoothScrolling','mouseWheelZoom',
      'autoClosingBrackets','autoClosingQuotes','stickyScroll.enabled',
      'linkedEditing','occurrencesHighlight','selectionHighlight','codeLens',
    ];

    const opts = {};
    for (const k of EDITOR_KEYS) {
      const v = get(`editor.${k}`);
      if (v !== undefined) opts[k] = v;
    }

    // Special compound options
    const qs = get('editor.quickSuggestions');
    if (qs !== undefined) opts.quickSuggestions = { other: qs, comments: false, strings: false };
    const ph = get('editor.parameterHints');
    if (ph !== undefined) opts.parameterHints = { enabled: ph };
    const mm = get('editor.minimap.enabled');
    if (mm !== undefined) opts.minimap = { enabled: mm };
    const bp = get('editor.bracketPairColorization.enabled');
    if (bp !== undefined) opts.bracketPairColorization = { enabled: bp };
    const is = get('editor.inlineSuggest.enabled');
    if (is !== undefined) opts.inlineSuggest = { enabled: is };
    const bl = get('editor.guides.bracketPairs');
    if (bl !== undefined) opts.guides = { bracketPairs: bl };

    try { ed.updateOptions(opts); } catch {}

    // Zoom
    const zoom = get('window.zoomLevel');
    if (zoom !== undefined && window.electronAPI?.setZoom) {
      try { window.electronAPI.setZoom(zoom); } catch {}
    }
  }

  // ── Persistence ───────────────────────────────────────────────
  function _saveUser()  {
    try { localStorage.setItem('noter.settings.user', JSON.stringify(_user)); } catch {}
  }
  function _saveWorkspace() {
    try { localStorage.setItem('noter.settings.workspace', JSON.stringify(_workspace)); } catch {}
  }
  function _saveProfiles() {
    try { localStorage.setItem('noter.settings.profiles', JSON.stringify(_userProfiles)); } catch {}
  }

  (function _load() {
    try { _user      = JSON.parse(localStorage.getItem('noter.settings.user')      || '{}'); } catch { _user = {}; }
    try { _workspace = JSON.parse(localStorage.getItem('noter.settings.workspace') || '{}'); } catch { _workspace = {}; }
    try { _userProfiles = JSON.parse(localStorage.getItem('noter.settings.profiles') || '{}'); } catch { _userProfiles = {}; }
    try { _activeProfile = localStorage.getItem('noter.settings.profile'); } catch {}
  })();

  document.addEventListener('monaco-ready', applyToEditor);

  return {
    get, set, setMany, reset, on, off, registerSchema,
    getProfiles, getActiveProfile, applyProfile, saveCurrentAsProfile, deleteProfile,
    exportSettings, importSettings,
    applyToEditor,
    BUILTIN,
  };
})();

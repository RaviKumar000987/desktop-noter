// ═══════════════════════════════════════════════════════════════
//  KEYBINDINGS ENGINE — keybindings.js
//  Default bindings · user overrides · chord sequences
//  Conflict detection · extension API · export/import
//  Depends on: command-registry.js
// ═══════════════════════════════════════════════════════════════

window.NoterKeybindings = (() => {

  // ── Default bindings (all Tier 1 + Tier 2 from roadmap) ───────
  const DEFAULTS = [
    // ── File ────────────────────────────────────────────────────
    { key: 'ctrl+n',              command: 'file.newFile',              label: 'New File',                 category: 'File' },
    { key: 'ctrl+t',              command: 'file.newTab',               label: 'New Tab',                  category: 'File' },
    { key: 'ctrl+o',              command: 'file.openFile',             label: 'Open File',                category: 'File' },
    { key: 'ctrl+k ctrl+o',       command: 'file.openFolder',           label: 'Open Folder',              category: 'File' },
    { key: 'ctrl+s',              command: 'file.save',                 label: 'Save',                     category: 'File' },
    { key: 'ctrl+shift+s',        command: 'file.saveAs',               label: 'Save As',                  category: 'File' },
    { key: 'ctrl+w',              command: 'file.closeTab',             label: 'Close Tab',                category: 'File' },
    { key: 'ctrl+shift+t',        command: 'file.reopenClosed',         label: 'Reopen Closed Tab',        category: 'File' },
    // ── Navigation ──────────────────────────────────────────────
    { key: 'ctrl+p',              command: 'nav.quickOpen',             label: 'Quick Open',               category: 'Navigation' },
    { key: 'ctrl+shift+p',        command: 'nav.commandPalette',        label: 'Command Palette',          category: 'Navigation' },
    { key: 'ctrl+g',              command: 'nav.gotoLine',              label: 'Go to Line',               category: 'Navigation' },
    { key: 'ctrl+shift+o',        command: 'nav.gotoSymbol',            label: 'Go to Symbol',             category: 'Navigation' },
    { key: 'f12',                 command: 'nav.gotoDefinition',        label: 'Go to Definition',         category: 'Navigation' },
    { key: 'alt+left',            command: 'nav.back',                  label: 'Navigate Back',            category: 'Navigation' },
    { key: 'alt+right',           command: 'nav.forward',               label: 'Navigate Forward',         category: 'Navigation' },
    { key: 'ctrl+tab',            command: 'nav.nextTab',               label: 'Next Tab',                 category: 'Navigation' },
    { key: 'ctrl+shift+tab',      command: 'nav.prevTab',               label: 'Previous Tab',             category: 'Navigation' },
    // ── Editing ──────────────────────────────────────────────────
    { key: 'ctrl+z',              command: 'edit.undo',                 label: 'Undo',                     category: 'Editing' },
    { key: 'ctrl+y',              command: 'edit.redo',                 label: 'Redo',                     category: 'Editing' },
    { key: 'ctrl+x',              command: 'edit.cut',                  label: 'Cut',                      category: 'Editing' },
    { key: 'ctrl+c',              command: 'edit.copy',                 label: 'Copy',                     category: 'Editing' },
    { key: 'ctrl+v',              command: 'edit.paste',                label: 'Paste',                    category: 'Editing' },
    { key: 'ctrl+a',              command: 'edit.selectAll',            label: 'Select All',               category: 'Editing' },
    { key: 'ctrl+d',              command: 'edit.duplicateLine',        label: 'Duplicate Line',           category: 'Editing' },
    { key: 'alt+up',              command: 'edit.moveLineUp',           label: 'Move Line Up',             category: 'Editing' },
    { key: 'alt+down',            command: 'edit.moveLineDown',         label: 'Move Line Down',           category: 'Editing' },
    { key: 'shift+alt+down',      command: 'edit.copyLineDown',         label: 'Copy Line Down',           category: 'Editing' },
    { key: 'ctrl+enter',          command: 'edit.insertLineBelow',      label: 'Insert Line Below',        category: 'Editing' },
    { key: 'ctrl+shift+enter',    command: 'edit.insertLineAbove',      label: 'Insert Line Above',        category: 'Editing' },
    { key: 'ctrl+shift+k',        command: 'edit.deleteLine',           label: 'Delete Line',              category: 'Editing' },
    // ── Search ────────────────────────────────────────────────────
    { key: 'ctrl+f',              command: 'search.find',               label: 'Find',                     category: 'Search' },
    { key: 'ctrl+h',              command: 'search.replace',            label: 'Replace',                  category: 'Search' },
    { key: 'f3',                  command: 'search.findNext',           label: 'Find Next',                category: 'Search' },
    { key: 'shift+f3',            command: 'search.findPrev',           label: 'Find Previous',            category: 'Search' },
    { key: 'ctrl+shift+f',        command: 'search.globalSearch',       label: 'Global Search',            category: 'Search' },
    { key: 'ctrl+shift+h',        command: 'search.replaceInFiles',     label: 'Replace in Files',         category: 'Search' },
    // ── Multi Cursor ──────────────────────────────────────────────
    { key: 'ctrl+shift+l',        command: 'cursor.selectAllOccurrences', label: 'Select All Occurrences', category: 'Multi Cursor' },
    { key: 'ctrl+alt+up',         command: 'cursor.addAbove',           label: 'Add Cursor Above',         category: 'Multi Cursor' },
    { key: 'ctrl+alt+down',       command: 'cursor.addBelow',           label: 'Add Cursor Below',         category: 'Multi Cursor' },
    { key: 'ctrl+f2',             command: 'cursor.selectAllMatches',   label: 'Select All Matching Words', category: 'Multi Cursor' },
    // ── Code Actions ──────────────────────────────────────────────
    { key: 'ctrl+space',          command: 'code.triggerSuggest',       label: 'Trigger Suggestions',      category: 'Code' },
    { key: 'ctrl+.',              command: 'code.quickFix',             label: 'Quick Fix',                category: 'Code' },
    { key: 'f2',                  command: 'code.rename',               label: 'Rename Symbol',            category: 'Code' },
    { key: 'shift+f12',           command: 'code.findReferences',       label: 'Find References',          category: 'Code' },
    { key: 'ctrl+shift+space',    command: 'code.paramHints',           label: 'Parameter Hints',          category: 'Code' },
    { key: 'alt+shift+f',         command: 'code.format',               label: 'Format Document',          category: 'Code' },
    { key: 'ctrl+/',              command: 'code.toggleComment',        label: 'Toggle Line Comment',      category: 'Code' },
    { key: 'shift+alt+a',         command: 'code.blockComment',         label: 'Toggle Block Comment',     category: 'Code' },
    { key: 'ctrl+shift+\\',       command: 'code.jumpBracket',          label: 'Jump to Bracket',          category: 'Code' },
    // ── Folding ───────────────────────────────────────────────────
    { key: 'ctrl+k ctrl+0',       command: 'fold.foldAll',              label: 'Fold All',                 category: 'Folding' },
    { key: 'ctrl+k ctrl+j',       command: 'fold.unfoldAll',            label: 'Unfold All',               category: 'Folding' },
    { key: 'ctrl+shift+[',        command: 'fold.foldRegion',           label: 'Fold Region',              category: 'Folding' },
    { key: 'ctrl+shift+]',        command: 'fold.unfoldRegion',         label: 'Unfold Region',            category: 'Folding' },
    // ── View ──────────────────────────────────────────────────────
    { key: 'ctrl+b',              command: 'view.toggleSidebar',        label: 'Toggle Sidebar',           category: 'View' },
    { key: 'ctrl+shift+e',        command: 'view.explorer',             label: 'Show Explorer',            category: 'View' },
    { key: 'ctrl+shift+x',        command: 'view.extensions',           label: 'Show Extensions',          category: 'View' },
    { key: 'ctrl+shift+g',        command: 'view.sourceControl',        label: 'Source Control',           category: 'View' },
    { key: 'ctrl+shift+m',        command: 'view.problems',             label: 'Show Problems Panel',      category: 'View' },
    { key: 'ctrl+j',              command: 'view.toggleTerminal',       label: 'Toggle Terminal',          category: 'View' },
    { key: 'ctrl+\\',             command: 'view.splitEditor',          label: 'Split Editor',             category: 'View' },
    { key: 'alt+z',               command: 'view.zenMode',              label: 'Toggle Zen Mode',          category: 'View' },
    { key: 'ctrl+k z',            command: 'view.zenMode',              label: 'Zen Mode (chord)',          category: 'View' },
    { key: 'ctrl+=',              command: 'view.zoomIn',               label: 'Zoom In',                  category: 'View' },
    { key: 'ctrl+-',              command: 'view.zoomOut',              label: 'Zoom Out',                 category: 'View' },
    { key: 'ctrl+0',              command: 'view.zoomReset',            label: 'Reset Zoom',               category: 'View' },
    // ── Workspace ─────────────────────────────────────────────────
    { key: 'ctrl+k ctrl+s',       command: 'workbench.keyboardShortcuts', label: 'Keyboard Shortcuts',     category: 'Workspace' },
    { key: 'ctrl+k ctrl+t',       command: 'workbench.themePicker',     label: 'Select Theme',             category: 'Workspace' },
    { key: 'ctrl+shift+d',        command: 'workbench.debug',           label: 'Debug Panel',              category: 'Workspace' },
    // ── Debug ─────────────────────────────────────────────────────
    { key: 'f5',                  command: 'debug.start',               label: 'Start Debugging',          category: 'Debug' },
    { key: 'shift+f5',            command: 'debug.stop',                label: 'Stop Debugging',           category: 'Debug' },
    { key: 'f10',                 command: 'debug.stepOver',            label: 'Step Over',                category: 'Debug' },
    { key: 'f11',                 command: 'debug.stepInto',            label: 'Step Into',                category: 'Debug' },
    { key: 'shift+f11',           command: 'debug.stepOut',             label: 'Step Out',                 category: 'Debug' },
    { key: 'f9',                  command: 'debug.toggleBreakpoint',    label: 'Toggle Breakpoint',        category: 'Debug' },
    // ── Help / Workspace ──────────────────────────────────────────
    { key: 'ctrl+shift+p',        command: 'nav.commandPalette',        label: 'Command Palette',          category: 'Navigation' },
    { key: 'ctrl+k ctrl+r',       command: 'help.welcome',              label: 'Welcome Page',             category: 'Help' },
  ];

  // ── User overrides: commandId → new key ───────────────────────
  let _user = {};

  // ── Extension-registered bindings ─────────────────────────────
  const _ext = [];

  // ── Chord state ───────────────────────────────────────────────
  let _chordPending = null;
  let _chordTimer   = null;

  // ── Cached index (rebuilt only when bindings change) ──────────
  let _cachedIdx            = null;
  let _cachedChordStarters  = null;

  function _invalidateCache() { _cachedIdx = null; _cachedChordStarters = null; }

  function _getIdx() {
    if (_cachedIdx) return _cachedIdx;
    const idx = new Map();
    for (const b of DEFAULTS) {
      const eff = b.command in _user ? _user[b.command] : b.key;
      if (eff) idx.set(eff, b.command);
    }
    for (const b of _ext) idx.set(b.key, b.command);
    _cachedIdx = idx;
    return idx;
  }

  function _getChordStarters() {
    if (_cachedChordStarters) return _cachedChordStarters;
    const starters = new Set();
    for (const k of _getIdx().keys()) {
      if (k.includes(' ')) starters.add(k.split(' ')[0]);
    }
    _cachedChordStarters = starters;
    return starters;
  }

  // Keys Monaco handles natively when editor is focused — we step aside
  const MONACO_OWNED = new Set([
    'ctrl+z','ctrl+y','ctrl+x','ctrl+c','ctrl+v','ctrl+a',
    'ctrl+f','ctrl+h','ctrl+d','ctrl+/',
    'alt+up','alt+down','shift+alt+down','ctrl+enter','ctrl+shift+enter',
    'ctrl+shift+k','ctrl+space','ctrl+shift+space','ctrl+shift+[','ctrl+shift+]',
    'ctrl+shift+l','ctrl+alt+up','ctrl+alt+down','ctrl+f2',
    'f2','f3','shift+f3','shift+f12','alt+shift+f','shift+alt+a','ctrl+shift+\\',
    // Typing aids — never intercept these
    'backspace','delete','enter','tab','escape',
    'up','down','left','right',
    'shift+up','shift+down','shift+left','shift+right',
    'ctrl+up','ctrl+down','ctrl+left','ctrl+right',
    'ctrl+shift+up','ctrl+shift+down','ctrl+shift+left','ctrl+shift+right',
    'home','end','pageup','pagedown',
    'shift+home','shift+end','shift+pageup','shift+pagedown',
  ]);

  // ── Normalise keyboard event → "ctrl+shift+k" style string ───
  function _norm(e) {
    const p = [];
    if (e.ctrlKey || e.metaKey) p.push('ctrl');
    if (e.altKey)               p.push('alt');
    if (e.shiftKey)             p.push('shift');
    const RAW = {
      ' ':'space','escape':'escape','enter':'enter','tab':'tab',
      'backspace':'backspace','delete':'delete',
      'home':'home','end':'end','pageup':'pageup','pagedown':'pagedown',
      'arrowup':'up','arrowdown':'down','arrowleft':'left','arrowright':'right',
      'f1':'f1','f2':'f2','f3':'f3','f4':'f4','f5':'f5','f6':'f6',
      'f7':'f7','f8':'f8','f9':'f9','f10':'f10','f11':'f11','f12':'f12',
    };
    const raw = e.key.toLowerCase();
    const k   = RAW[raw] || raw;
    if (!['control','alt','shift','meta'].includes(k)) p.push(k);
    return p.length ? p.join('+') : '';
  }

  // ── Global keydown handler (capture phase) ────────────────────
  function _onKey(e) {
    try {
      // Never intercept pure typing in real inputs
      const tag = (e.target?.tagName || '').toLowerCase();
      if (['input','textarea','select'].includes(tag) && !e.ctrlKey && !e.metaKey && !e.altKey) return;

      const key = _norm(e);
      if (!key || ['ctrl','alt','shift','meta'].includes(key)) return;

      // Never block single-char keys (letters, digits, symbols) — only combos
      if (!e.ctrlKey && !e.metaKey && !e.altKey && key.length <= 2) return;

      const idx          = _getIdx();
      const monacoFocus  = !!document.activeElement?.closest('.monaco-editor');

      // Always let Monaco handle its own keys when it's focused
      if (monacoFocus && MONACO_OWNED.has(key)) return;

      // ── Chord completion ─────────────────────────────────────
      if (_chordPending) {
        const chord = `${_chordPending} ${key}`;
        clearTimeout(_chordTimer);
        _chordPending = null;
        if (idx.has(chord)) {
          e.preventDefault(); e.stopImmediatePropagation();
          setTimeout(() => NoterCommands.execute(idx.get(chord)), 0);
          return;
        }
        // Unknown chord second key → let it through normally
        return;
      }

      // ── Chord starter detection ───────────────────────────────
      if (_getChordStarters().has(key)) {
        e.preventDefault(); e.stopImmediatePropagation();
        _chordPending = key;
        clearTimeout(_chordTimer);
        _chordTimer = setTimeout(() => { _chordPending = null; }, 1500);
        _showChordHint(key);
        return;
      }

      // ── Regular binding ───────────────────────────────────────
      if (!idx.has(key)) return;

      e.preventDefault(); e.stopImmediatePropagation();
      setTimeout(() => NoterCommands.execute(idx.get(key)), 0);

    } catch (err) {
      // Safety: never let our handler crash and leave the keyboard in a broken state
      console.warn('[Keybindings] Error in keydown handler:', err);
      _chordPending = null;
      clearTimeout(_chordTimer);
    }
  }

  // ── Chord hint ────────────────────────────────────────────────
  function _showChordHint(firstKey) {
    let el = document.getElementById('kb-chord-hint');
    if (!el) {
      el = Object.assign(document.createElement('div'), { id: 'kb-chord-hint' });
      el.style.cssText = [
        'position:fixed;bottom:40px;right:16px',
        'background:#1e1e2e;color:#cdd6f4',
        'border:1px solid #45475a;border-radius:6px',
        'padding:6px 12px;font-size:11px;font-family:var(--font-mono,monospace)',
        'z-index:99999;transition:opacity .15s;pointer-events:none',
      ].join(';');
      document.body.appendChild(el);
    }
    el.textContent = `${firstKey.toUpperCase()} — waiting for second key…`;
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 1400);
  }

  // ── Public: user binding management ──────────────────────────
  function setUserBinding(commandId, key) {
    _user[commandId] = key;
    _invalidateCache();
    _save();
  }

  function resetBinding(commandId) {
    delete _user[commandId];
    _invalidateCache();
    _save();
  }

  function resetAll() {
    _user = {};
    _invalidateCache();
    _save();
  }

  // Emergency reset — clears any stuck chord state and re-enables keyboard
  function reset() {
    _chordPending = null;
    clearTimeout(_chordTimer);
    _chordTimer = null;
  }

  function getEffectiveKey(commandId) {
    if (commandId in _user) return _user[commandId];
    return DEFAULTS.find(b => b.command === commandId)?.key || '';
  }

  function getConflicts(key, excludeCommand = null) {
    return getAll().filter(b => b.effectiveKey === key && b.command !== excludeCommand);
  }

  function getAll() {
    const rows = DEFAULTS.map(b => ({
      ...b,
      effectiveKey: b.command in _user ? _user[b.command] : b.key,
      isCustom:     b.command in _user,
      source:       'built-in',
    }));
    for (const b of _ext) {
      rows.push({ ...b, effectiveKey: b.key, isCustom: false, source: b.source || 'extension' });
    }
    return rows;
  }

  // ── Extension API ─────────────────────────────────────────────
  function registerExtension(key, commandId, opts = {}) {
    _ext.push({
      key, command: commandId,
      label:    opts.label    || commandId,
      category: opts.category || 'Extensions',
      source:   opts.source   || 'extension',
    });
  }

  // ── Export / Import ───────────────────────────────────────────
  function exportBindings() { return JSON.stringify(_user, null, 2); }

  function importBindings(json) {
    try { _user = JSON.parse(json); _save(); return true; }
    catch { return false; }
  }

  // ── Persistence ───────────────────────────────────────────────
  function _save() {
    try { localStorage.setItem('noter.keybindings', JSON.stringify(_user)); } catch {}
  }

  (function _load() {
    try { _user = JSON.parse(localStorage.getItem('noter.keybindings') || '{}'); }
    catch { _user = {}; }
  })();

  document.addEventListener('keydown', _onKey, true);

  return {
    DEFAULTS,
    getAll, getEffectiveKey, getConflicts,
    setUserBinding, resetBinding, resetAll, reset,
    registerExtension,
    exportBindings, importBindings,
  };
})();

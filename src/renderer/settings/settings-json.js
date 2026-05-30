// ═══════════════════════════════════════════════════════════════
//  SETTINGS JSON ENGINE — settings-json.js  (renderer)
//  VS Code-style settings.json reader + live applier.
//
//  Priority: workspace settings > user settings.json > defaults
//  All keys follow VS Code's naming convention (editor.fontSize etc.)
//
//  Usage:
//    SettingsJSON.load()          — called once on startup
//    SettingsJSON.get(key)        — get a resolved value
//    SettingsJSON.openFile()      — open settings.json in editor tab
//    SettingsJSON.openDefaults()  — open read-only defaults reference
// ═══════════════════════════════════════════════════════════════
'use strict';

window.SettingsJSON = (() => {
  let _settings = {};  // merged: defaults + user
  let _autoSaveTimer = null;

  // ── Getters ───────────────────────────────────────────────────
  function get(key, fallback = undefined) {
    return key in _settings ? _settings[key] : fallback;
  }

  // ── Apply all settings to the live app ───────────────────────
  function applyAll(settings) {
    _settings = settings;
    _applyEditor(settings);
    _applyTerminal(settings);
    _applyWorkbench(settings);
    _applyAutoSave(settings);
  }

  // ── Monaco editor options ─────────────────────────────────────
  function _applyEditor(s) {
    if (!window.editor) return;

    const opts = {};

    if ('editor.fontSize'                    in s) opts.fontSize                    = s['editor.fontSize'];
    if ('editor.fontFamily'                  in s) opts.fontFamily                  = s['editor.fontFamily'];
    if ('editor.fontLigatures'               in s) opts.fontLigatures               = s['editor.fontLigatures'];
    if ('editor.fontWeight'                  in s) opts.fontWeight                  = s['editor.fontWeight'];
    if ('editor.lineHeight'                  in s) opts.lineHeight                  = s['editor.lineHeight'];
    if ('editor.letterSpacing'               in s) opts.letterSpacing               = s['editor.letterSpacing'];
    if ('editor.tabSize'                     in s) opts.tabSize                     = s['editor.tabSize'];
    if ('editor.insertSpaces'                in s) opts.insertSpaces                = s['editor.insertSpaces'];
    if ('editor.detectIndentation'           in s) opts.detectIndentation           = s['editor.detectIndentation'];
    if ('editor.wordWrap'                    in s) opts.wordWrap                    = s['editor.wordWrap'];
    if ('editor.wordWrapColumn'              in s) opts.wordWrapColumn              = s['editor.wordWrapColumn'];
    if ('editor.lineNumbers'                 in s) opts.lineNumbers                 = s['editor.lineNumbers'];
    if ('editor.rulers'                      in s) opts.rulers                      = s['editor.rulers'];
    if ('editor.cursorStyle'                 in s) opts.cursorStyle                 = s['editor.cursorStyle'];
    if ('editor.cursorBlinking'              in s) opts.cursorBlinking              = s['editor.cursorBlinking'];
    if ('editor.cursorWidth'                 in s) opts.cursorWidth                 = s['editor.cursorWidth'];
    if ('editor.smoothScrolling'             in s) opts.smoothScrolling             = s['editor.smoothScrolling'];
    if ('editor.mouseWheelZoom'              in s) opts.mouseWheelZoom              = s['editor.mouseWheelZoom'];
    if ('editor.scrollBeyondLastLine'        in s) opts.scrollBeyondLastLine        = s['editor.scrollBeyondLastLine'];
    if ('editor.renderWhitespace'            in s) opts.renderWhitespace            = s['editor.renderWhitespace'];
    if ('editor.renderLineHighlight'         in s) opts.renderLineHighlight         = s['editor.renderLineHighlight'];
    if ('editor.occurrencesHighlight'        in s) opts.occurrencesHighlight        = s['editor.occurrencesHighlight'];
    if ('editor.selectionHighlight'          in s) opts.selectionHighlight          = s['editor.selectionHighlight'];
    if ('editor.overviewRulerBorder'         in s) opts.overviewRulerBorder         = s['editor.overviewRulerBorder'];
    if ('editor.roundedSelection'            in s) opts.roundedSelection            = s['editor.roundedSelection'];
    if ('editor.matchBrackets'               in s) opts.matchBrackets               = s['editor.matchBrackets'];
    if ('editor.autoClosingBrackets'         in s) opts.autoClosingBrackets         = s['editor.autoClosingBrackets'];
    if ('editor.autoClosingQuotes'           in s) opts.autoClosingQuotes           = s['editor.autoClosingQuotes'];
    if ('editor.autoSurround'               in s) opts.autoSurround                = s['editor.autoSurround'];
    if ('editor.folding'                     in s) opts.folding                     = s['editor.folding'];
    if ('editor.foldingHighlight'            in s) opts.foldingHighlight            = s['editor.foldingHighlight'];
    if ('editor.foldingStrategy'             in s) opts.foldingStrategy             = s['editor.foldingStrategy'];
    if ('editor.showFoldingControls'         in s) opts.showFoldingControls         = s['editor.showFoldingControls'];
    if ('editor.formatOnPaste'               in s) opts.formatOnPaste               = s['editor.formatOnPaste'];
    if ('editor.formatOnType'                in s) opts.formatOnType                = s['editor.formatOnType'];
    if ('editor.trimAutoWhitespace'          in s) opts.trimAutoWhitespace          = s['editor.trimAutoWhitespace'];
    if ('editor.multiCursorModifier'         in s) opts.multiCursorModifier         = s['editor.multiCursorModifier'];
    if ('editor.accessibilitySupport'        in s) opts.accessibilitySupport        = s['editor.accessibilitySupport'];
    if ('editor.linkedEditing'               in s) opts.linkedEditing               = s['editor.linkedEditing'];
    if ('editor.quickSuggestionsDelay'       in s) opts.quickSuggestionsDelay       = s['editor.quickSuggestionsDelay'];
    if ('editor.suggestOnTriggerCharacters'  in s) opts.suggestOnTriggerCharacters  = s['editor.suggestOnTriggerCharacters'];
    if ('editor.acceptSuggestionOnEnter'     in s) opts.acceptSuggestionOnEnter     = s['editor.acceptSuggestionOnEnter'];
    if ('editor.tabCompletion'               in s) opts.tabCompletion               = s['editor.tabCompletion'];
    if ('editor.wordBasedSuggestions'        in s) opts.wordBasedSuggestions        = s['editor.wordBasedSuggestions'];

    // Nested options
    if ('editor.minimap.enabled'             in s ||
        'editor.minimap.autohide'            in s ||
        'editor.minimap.renderCharacters'    in s ||
        'editor.minimap.scale'               in s ||
        'editor.minimap.side'                in s) {
      opts.minimap = {
        enabled:          s['editor.minimap.enabled']          ?? true,
        autohide:         s['editor.minimap.autohide']         ?? true,
        renderCharacters: s['editor.minimap.renderCharacters'] ?? false,
        scale:            s['editor.minimap.scale']            ?? 1,
        side:             s['editor.minimap.side']             ?? 'right',
      };
    }
    if ('editor.bracketPairColorization.enabled' in s ||
        'editor.guides.indentation'              in s ||
        'editor.guides.bracketPairs'             in s) {
      opts.bracketPairColorization = { enabled: s['editor.bracketPairColorization.enabled'] ?? true };
      opts.guides = {
        indentation:   s['editor.guides.indentation']  ?? true,
        bracketPairs:  s['editor.guides.bracketPairs'] ?? true,
      };
    }
    if ('editor.stickyScroll.enabled'      in s ||
        'editor.stickyScroll.maxLineCount' in s) {
      opts.stickyScroll = {
        enabled:      s['editor.stickyScroll.enabled']      ?? true,
        maxLineCount: s['editor.stickyScroll.maxLineCount'] ?? 5,
      };
    }
    if ('editor.inlayHints.enabled' in s) {
      opts.inlayHints = { enabled: s['editor.inlayHints.enabled'] };
    }
    if ('editor.parameterHints.enabled' in s) {
      opts.parameterHints = { enabled: s['editor.parameterHints.enabled'], cycle: true };
    }
    if ('editor.quickSuggestions.other'    in s ||
        'editor.quickSuggestions.comments' in s ||
        'editor.quickSuggestions.strings'  in s) {
      opts.quickSuggestions = {
        other:    s['editor.quickSuggestions.other']    ?? true,
        comments: s['editor.quickSuggestions.comments'] ?? true,
        strings:  s['editor.quickSuggestions.strings']  ?? true,
      };
    }

    if (Object.keys(opts).length > 0) {
      window.editor.updateOptions(opts);
    }

    // Sync wordWrapEnabled global so status bar is correct
    if ('editor.wordWrap' in s && typeof window.wordWrapEnabled !== 'undefined') {
      window.wordWrapEnabled = s['editor.wordWrap'] !== 'off';
    }
    // Sync font size global
    if ('editor.fontSize' in s && typeof window.editorFontSize !== 'undefined') {
      window.editorFontSize = s['editor.fontSize'];
    }
  }

  // ── Terminal options ──────────────────────────────────────────
  function _applyTerminal(s) {
    // xterm options must be set via term.options (xterm 5.x API)
    // We dispatch a custom event that terminal.js can listen to.
    const termOpts = {};
    if ('terminal.integrated.fontSize'      in s) termOpts.fontSize      = s['terminal.integrated.fontSize'];
    if ('terminal.integrated.fontFamily'    in s) termOpts.fontFamily    = s['terminal.integrated.fontFamily'];
    if ('terminal.integrated.fontWeight'    in s) termOpts.fontWeight    = s['terminal.integrated.fontWeight'];
    if ('terminal.integrated.lineHeight'    in s) termOpts.lineHeight    = s['terminal.integrated.lineHeight'];
    if ('terminal.integrated.letterSpacing' in s) termOpts.letterSpacing = s['terminal.integrated.letterSpacing'];
    if ('terminal.integrated.cursorStyle'   in s) termOpts.cursorStyle   = s['terminal.integrated.cursorStyle'];
    if ('terminal.integrated.cursorBlink'   in s) termOpts.cursorBlink   = s['terminal.integrated.cursorBlink'];
    if ('terminal.integrated.scrollback'    in s) termOpts.scrollback    = s['terminal.integrated.scrollback'];
    if (Object.keys(termOpts).length > 0) {
      window.dispatchEvent(new CustomEvent('noter:terminal-options', { detail: termOpts }));
    }
  }

  // ── Workbench / UI ─────────────────────────────────────────────
  function _applyWorkbench(s) {
    // Status bar visibility
    if ('workbench.statusBar.visible' in s) {
      const sb = document.getElementById('statusbar');
      if (sb) sb.style.display = s['workbench.statusBar.visible'] ? '' : 'none';
    }
    // Sidebar visibility
    if ('workbench.sideBar.visible' in s && typeof window.sidebarVisible !== 'undefined') {
      const shouldShow = !!s['workbench.sideBar.visible'];
      if (shouldShow !== window.sidebarVisible) {
        if (typeof toggleSidebar === 'function') toggleSidebar(shouldShow);
      }
    }
    // Activity bar visibility
    if ('workbench.activityBar.visible' in s) {
      const ab = document.getElementById('activity-bar');
      if (ab) ab.style.display = s['workbench.activityBar.visible'] ? '' : 'none';
    }
    // Window zoom
    if ('window.zoomLevel' in s) {
      const zoom = 1 + (s['window.zoomLevel'] * 0.1);
      document.body.style.zoom = Math.max(0.5, Math.min(3, zoom));
    }
  }

  // ── Auto-save ─────────────────────────────────────────────────
  function _applyAutoSave(s) {
    const mode  = s['editor.autoSave']  || s['files.autoSave']  || 'off';
    const delay = s['editor.autoSaveDelay'] || s['files.autoSaveDelay'] || 1000;

    clearInterval(_autoSaveTimer);
    _autoSaveTimer = null;

    if (mode === 'afterDelay') {
      // Poll: save active tab if modified, every `delay` ms
      _autoSaveTimer = setInterval(() => {
        const tab = typeof TabManager !== 'undefined' ? TabManager.getActive?.() : null;
        if (tab?.isModified && tab?.filePath && typeof actions !== 'undefined') {
          actions.saveFile?.();
        }
      }, delay);
    }
    // 'onFocusChange' and 'onWindowChange' are handled via focus events in app.js
    // (they'd need app.js integration — marking as future improvement)
  }

  // ── Load from main process on startup ─────────────────────────
  async function load() {
    try {
      const settings = await window.electronAPI?.settingsJsonRead?.();
      if (settings) applyAll(settings);
    } catch (e) {
      console.warn('[SettingsJSON] Load failed:', e.message);
    }

    // Watch for external file changes (user edits settings.json in editor)
    window.electronAPI?.onSettingsJsonChanged?.((settings) => {
      applyAll(settings);
      if (typeof showToast === 'function') {
        showToast('Settings reloaded from settings.json', 'info', 2000);
      }
    });
  }

  // ── Open settings.json in editor tab ──────────────────────────
  async function openFile() {
    const filePath = await window.electronAPI?.settingsJsonGetPath?.();
    if (!filePath) return;

    // Use the app's existing "open file by path" mechanism
    if (typeof openFileByPath === 'function') {
      await openFileByPath(filePath);
    } else if (typeof TabManager !== 'undefined') {
      const existing = TabManager.tabs?.find(t => t.filePath === filePath);
      if (existing) { TabManager.activate(existing.id); return; }
      const raw = await window.electronAPI?.settingsJsonReadRaw?.() ?? '{}';
      const tab = TabManager.create(filePath, raw, 'json');
      TabManager.activate(tab.id);
    }
  }

  // ── Open read-only defaults reference ─────────────────────────
  async function openDefaults() {
    const defaults = await window.electronAPI?.settingsJsonGetDefaults?.();
    if (!defaults || typeof TabManager === 'undefined') return;

    const content = JSON.stringify(defaults, null, 2);
    const tab = TabManager.create(null, content, 'json');
    tab.title = 'Default Settings (Read Only)';
    TabManager.activate(tab.id);
    if (typeof renderTabs === 'function') renderTabs();
    // Make it read-only
    requestAnimationFrame(() => {
      window.editor?.updateOptions?.({ readOnly: true });
      setTimeout(() => window.editor?.updateOptions?.({ readOnly: false }), 100);
    });
  }

  // ── Save raw text back to settings.json ───────────────────────
  async function saveRaw(text) {
    const result = await window.electronAPI?.settingsJsonWriteRaw?.(text);
    if (!result?.ok && typeof showToast === 'function') {
      showToast('settings.json has a JSON syntax error — not saved', 'error', 3500);
    }
    return result;
  }

  // ── Format on Save hook ───────────────────────────────────────
  // Called from app.js saveFile() after a successful save
  function shouldFormatOnSave() {
    return !!_settings['editor.formatOnSave'];
  }

  return { load, get, applyAll, openFile, openDefaults, saveRaw, shouldFormatOnSave };
})();

// ── Wire terminal options event to xterm ─────────────────────────
// terminal.js listens for 'noter:terminal-options' custom event
window.addEventListener('noter:terminal-options', (e) => {
  // This is handled inside terminal.js — see the event listener added there
});

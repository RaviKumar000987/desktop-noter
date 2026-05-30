// ═══════════════════════════════════════════════════════════════
//  COMMAND PALETTE — command-palette.js
//  Ctrl+Shift+P · All commands registered here into NoterCommands
//  Deps: command-registry.js (must load first), app.js globals
// ═══════════════════════════════════════════════════════════════

// ── Register ALL built-in commands ───────────────────────────
// (runs after DOMContentLoaded so app.js globals are available)
document.addEventListener('DOMContentLoaded', () => {
  const ed  = () => window.editor;
  const tr  = (id) => ed()?.trigger('kbd', id, null);

  NoterCommands.registerMany([

    // ── File ────────────────────────────────────────────────────
    { id: 'file.newFile',     title: 'New File',           category: 'File',   aliases: ['new','create'],
      handler: () => window.actions?.newFile?.() },
    { id: 'file.newTab',      title: 'New Tab',            category: 'File',
      handler: () => window.actions?.newFile?.() },
    { id: 'file.openFile',    title: 'Open File…',         category: 'File',   aliases: ['open'],
      handler: () => window.actions?.openFile?.() },
    { id: 'file.openFolder',  title: 'Open Folder…',       category: 'File',   aliases: ['open folder','workspace'],
      handler: () => window.actions?.openFolder?.() },
    { id: 'file.save',        title: 'Save',               category: 'File',
      handler: () => window.actions?.saveFile?.() },
    { id: 'file.saveAs',      title: 'Save As…',           category: 'File',   aliases: ['save as'],
      handler: () => window.actions?.saveAsFile?.() },
    { id: 'file.closeTab',    title: 'Close Tab',          category: 'File',   aliases: ['close'],
      handler: () => { const t = window.TabManager?.getActive?.(); if (t) window.TabManager.close(t.id); } },
    { id: 'file.closeAll',    title: 'Close All Tabs',     category: 'File',
      handler: () => window.TabManager?.closeAll?.() },
    { id: 'file.reopenClosed',title: 'Reopen Closed Tab',  category: 'File',   aliases: ['reopen'],
      handler: () => window.toast?.('Reopen Closed Tab — coming soon', 'info') },
    { id: 'file.saveAll',     title: 'Save All',           category: 'File',
      handler: async () => {
        const tabs = window.TabManager?.tabs || [];
        const active = window.TabManager?.getActive?.();
        for (const t of tabs) {
          if (t.isModified && t.filePath) {
            window.TabManager?.activate?.(t.id);
            await window.actions?.saveFile?.();
          }
        }
        if (active) window.TabManager?.activate?.(active.id);
      } },
    { id: 'file.newWorkspace', title: 'New Workspace',     category: 'File',
      handler: () => typeof createWorkspace === 'function' && createWorkspace() },
    { id: 'file.saveWorkspace', title: 'Save Workspace',   category: 'File',
      handler: () => typeof saveWorkspace === 'function' && saveWorkspace() },
    { id: 'file.openWorkspace', title: 'Open Workspace…',  category: 'File',
      handler: () => typeof openWorkspace === 'function' && openWorkspace() },
    { id: 'file.quit',        title: 'Quit',               category: 'File',   aliases: ['exit','quit'],
      handler: () => window.electronAPI?.quit?.() },

    // ── Navigation ───────────────────────────────────────────────
    { id: 'nav.quickOpen',       title: 'Quick Open File…',    category: 'Navigation', aliases: ['quick open','open file'],
      handler: () => window.QuickOpen?.show?.() },
    { id: 'nav.commandPalette',  title: 'Command Palette',      category: 'Navigation', aliases: ['commands'],
      handler: () => CommandPalette.toggle() },
    { id: 'nav.gotoLine',        title: 'Go to Line…',          category: 'Navigation', aliases: ['goto','go to'],
      handler: () => tr('editor.action.gotoLine') },
    { id: 'nav.gotoSymbol',      title: 'Go to Symbol…',        category: 'Navigation', aliases: ['symbol'],
      handler: () => tr('editor.action.gotoSymbol') },
    { id: 'nav.gotoDefinition',  title: 'Go to Definition',     category: 'Navigation',
      handler: () => tr('editor.action.revealDefinition') },
    { id: 'nav.peekDefinition',  title: 'Peek Definition',      category: 'Navigation',
      handler: () => tr('editor.action.peekDefinition') },
    { id: 'nav.findReferences',  title: 'Find All References',  category: 'Navigation',
      handler: () => tr('references-view.findReferences') },
    { id: 'nav.back',            title: 'Navigate Back',         category: 'Navigation',
      handler: () => tr('workbench.action.navigateBack') },
    { id: 'nav.forward',         title: 'Navigate Forward',      category: 'Navigation',
      handler: () => tr('workbench.action.navigateForward') },
    { id: 'nav.nextTab',         title: 'Next Tab',              category: 'Navigation',
      handler: () => {
        const tabs = window.TabManager?.tabs || []; if (!tabs.length) return;
        const i = tabs.findIndex(t => t.id === window.TabManager?.getActive?.()?.id);
        window.TabManager?.activate?.(tabs[(i + 1) % tabs.length]?.id);
      } },
    { id: 'nav.prevTab',         title: 'Previous Tab',          category: 'Navigation',
      handler: () => {
        const tabs = window.TabManager?.tabs || []; if (!tabs.length) return;
        const i = tabs.findIndex(t => t.id === window.TabManager?.getActive?.()?.id);
        window.TabManager?.activate?.(tabs[(i - 1 + tabs.length) % tabs.length]?.id);
      } },

    // ── Editing ──────────────────────────────────────────────────
    { id: 'edit.undo',           title: 'Undo',                  category: 'Editing',
      handler: () => window.actions?.undo?.() },
    { id: 'edit.redo',           title: 'Redo',                  category: 'Editing',
      handler: () => window.actions?.redo?.() },
    { id: 'edit.cut',            title: 'Cut',                   category: 'Editing',
      handler: () => window.actions?.cut?.() },
    { id: 'edit.copy',           title: 'Copy',                  category: 'Editing',
      handler: () => window.actions?.copy?.() },
    { id: 'edit.paste',          title: 'Paste',                 category: 'Editing',
      handler: () => window.actions?.paste?.() },
    { id: 'edit.selectAll',      title: 'Select All',            category: 'Editing',
      handler: () => window.actions?.selectAll?.() },
    { id: 'edit.duplicateLine',  title: 'Duplicate Line',        category: 'Editing',
      handler: () => window.actions?.duplicateLine?.() },
    { id: 'edit.moveLineUp',     title: 'Move Line Up',          category: 'Editing',
      handler: () => tr('editor.action.moveLinesUpAction') },
    { id: 'edit.moveLineDown',   title: 'Move Line Down',        category: 'Editing',
      handler: () => tr('editor.action.moveLinesDownAction') },
    { id: 'edit.copyLineDown',   title: 'Copy Line Down',        category: 'Editing',
      handler: () => tr('editor.action.copyLinesDownAction') },
    { id: 'edit.insertLineBelow',title: 'Insert Line Below',     category: 'Editing',
      handler: () => tr('editor.action.insertLineAfter') },
    { id: 'edit.insertLineAbove',title: 'Insert Line Above',     category: 'Editing',
      handler: () => tr('editor.action.insertLineBefore') },
    { id: 'edit.deleteLine',     title: 'Delete Line',           category: 'Editing',
      handler: () => tr('editor.action.deleteLines') },
    { id: 'edit.joinLines',      title: 'Join Lines',            category: 'Editing',
      handler: () => tr('editor.action.joinLines') },
    { id: 'edit.sortLinesAsc',   title: 'Sort Lines Ascending',  category: 'Editing',
      handler: () => tr('editor.action.sortLinesAscending') },
    { id: 'edit.sortLinesDesc',  title: 'Sort Lines Descending', category: 'Editing',
      handler: () => tr('editor.action.sortLinesDescending') },

    // ── Search ────────────────────────────────────────────────────
    { id: 'search.find',         title: 'Find',                  category: 'Search',
      handler: () => window.actions?.find?.() },
    { id: 'search.replace',      title: 'Replace',               category: 'Search',
      handler: () => window.actions?.replace?.() },
    { id: 'search.findNext',     title: 'Find Next',             category: 'Search',
      handler: () => tr('editor.action.nextMatchFindAction') },
    { id: 'search.findPrev',     title: 'Find Previous',         category: 'Search',
      handler: () => tr('editor.action.previousMatchFindAction') },
    { id: 'search.globalSearch', title: 'Global Search',         category: 'Search', aliases: ['search files','find in files'],
      handler: () => window.GlobalSearch?.show?.() },
    { id: 'search.replaceInFiles', title: 'Replace in Files',    category: 'Search',
      handler: () => window.GlobalSearch?.show?.() },
    { id: 'search.clearResults', title: 'Clear Search Results',  category: 'Search',
      handler: () => window.GlobalSearch?.clear?.() },

    // ── Multi Cursor ──────────────────────────────────────────────
    { id: 'cursor.selectAllOccurrences', title: 'Select All Occurrences', category: 'Multi Cursor', aliases: ['select all'],
      handler: () => tr('editor.action.selectHighlights') },
    { id: 'cursor.addAbove',  title: 'Add Cursor Above',         category: 'Multi Cursor',
      handler: () => tr('editor.action.insertCursorAbove') },
    { id: 'cursor.addBelow',  title: 'Add Cursor Below',         category: 'Multi Cursor',
      handler: () => tr('editor.action.insertCursorBelow') },
    { id: 'cursor.selectAllMatches', title: 'Select All Matching Words', category: 'Multi Cursor',
      handler: () => tr('editor.action.changeAll') },

    // ── Code ──────────────────────────────────────────────────────
    { id: 'code.triggerSuggest', title: 'Trigger Suggestions',   category: 'Code', aliases: ['autocomplete','intellisense'],
      handler: () => tr('editor.action.triggerSuggest') },
    { id: 'code.quickFix',      title: 'Quick Fix',              category: 'Code', aliases: ['fix','lightbulb'],
      handler: () => tr('editor.action.quickFix') },
    { id: 'code.rename',        title: 'Rename Symbol',          category: 'Code', aliases: ['rename'],
      handler: () => tr('editor.action.rename') },
    { id: 'code.findReferences',title: 'Find References',        category: 'Code',
      handler: () => tr('references-view.findReferences') },
    { id: 'code.paramHints',    title: 'Parameter Hints',        category: 'Code',
      handler: () => tr('editor.action.triggerParameterHints') },
    { id: 'code.format',        title: 'Format Document',        category: 'Code', aliases: ['format','prettify','indent'],
      handler: () => tr('editor.action.formatDocument') },
    { id: 'code.formatSelection', title: 'Format Selection',     category: 'Code',
      handler: () => tr('editor.action.formatSelection') },
    { id: 'code.organizeImports', title: 'Organize Imports',     category: 'Code',
      handler: () => tr('editor.action.organizeImports') },
    { id: 'code.toggleComment', title: 'Toggle Line Comment',    category: 'Code', aliases: ['comment'],
      handler: () => tr('editor.action.commentLine') },
    { id: 'code.blockComment',  title: 'Toggle Block Comment',   category: 'Code',
      handler: () => tr('editor.action.blockComment') },
    { id: 'code.jumpBracket',   title: 'Jump to Matching Bracket', category: 'Code',
      handler: () => tr('editor.action.jumpToBracket') },

    // ── Folding ───────────────────────────────────────────────────
    { id: 'fold.foldAll',       title: 'Fold All',               category: 'Folding',
      handler: () => tr('editor.foldAll') },
    { id: 'fold.unfoldAll',     title: 'Unfold All',             category: 'Folding',
      handler: () => tr('editor.unfoldAll') },
    { id: 'fold.foldRegion',    title: 'Fold Region',            category: 'Folding',
      handler: () => tr('editor.fold') },
    { id: 'fold.unfoldRegion',  title: 'Unfold Region',          category: 'Folding',
      handler: () => tr('editor.unfold') },

    // ── View ──────────────────────────────────────────────────────
    { id: 'view.toggleSidebar', title: 'Toggle Sidebar',         category: 'View', aliases: ['sidebar','explorer'],
      handler: () => typeof toggleSidebar === 'function' && toggleSidebar() },
    { id: 'view.explorer',      title: 'Show Explorer',          category: 'View',
      handler: () => document.getElementById('ab-explorer')?.click() },
    { id: 'view.extensions',    title: 'Show Extensions',        category: 'View', aliases: ['marketplace','extensions'],
      handler: () => window.Marketplace?.open?.() },
    { id: 'view.sourceControl', title: 'Show Source Control',    category: 'View', aliases: ['git','scm'],
      handler: () => window.toast?.('Git UI coming in Phase 3', 'info') },
    { id: 'view.problems',      title: 'Show Problems',          category: 'View',
      handler: () => {
        // Open the bottom panel and switch to Problems tab
        window.TerminalPanel?.show?.();
        setTimeout(() => document.querySelector('[data-tab="problems"]')?.click(), 80);
      } },
    { id: 'view.toggleTerminal',title: 'Toggle Terminal',        category: 'View', aliases: ['terminal'],
      handler: () => window.TerminalPanel?.toggle?.() },
    { id: 'view.splitEditor',   title: 'Split Editor',           category: 'View', aliases: ['split'],
      handler: () => window.SplitEditor?.toggle?.() },
    { id: 'view.zenMode',       title: 'Toggle Zen Mode',        category: 'View', aliases: ['zen','distraction free'],
      handler: () => typeof toggleZenMode === 'function' && toggleZenMode() },
    { id: 'view.toggleWordWrap',title: 'Toggle Word Wrap',       category: 'View', aliases: ['wrap'],
      handler: () => typeof toggleWordWrap === 'function' ? toggleWordWrap() : window.actions?.toggleWordWrap?.() },
    { id: 'view.zoomIn',        title: 'Zoom In',                category: 'View',
      handler: () => window.actions?.zoomIn?.() },
    { id: 'view.zoomOut',       title: 'Zoom Out',               category: 'View',
      handler: () => window.actions?.zoomOut?.() },
    { id: 'view.zoomReset',     title: 'Reset Zoom',             category: 'View',
      handler: () => window.actions?.resetZoom?.() },
    { id: 'view.toggleMinimap', title: 'Toggle Minimap',         category: 'View',
      handler: () => {
        const v = !window.NoterSettings?.get('editor.minimap.enabled');
        window.NoterSettings?.set('editor.minimap.enabled', v);
        ed()?.updateOptions({ minimap: { enabled: v } });
      } },
    { id: 'view.toggleBreadcrumbs', title: 'Toggle Breadcrumbs', category: 'View',
      handler: () => {
        const el = document.getElementById('breadcrumb');
        if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
      } },
    { id: 'view.fullscreen',    title: 'Toggle Full Screen',     category: 'View',
      handler: () => window.electronAPI?.toggleFullScreen?.() || document.documentElement.requestFullscreen?.() },

    // ── Workspace ─────────────────────────────────────────────────
    { id: 'workbench.themePicker', title: 'Select Color Theme',  category: 'Workspace', aliases: ['theme'],
      handler: () => window.SettingsUI?.open?.() },
    { id: 'workbench.debug',    title: 'Debug Panel',            category: 'Workspace',
      handler: () => { window.toast?.('Debugger coming in a future update', 'info'); } },
    { id: 'workbench.reloadWindow', title: 'Reload Window',      category: 'Developer',
      handler: () => location.reload() },
    { id: 'workbench.devtools', title: 'Open DevTools',          category: 'Developer',
      handler: () => window.electronAPI?.openDevTools?.() },
    { id: 'workbench.rebuildIndex', title: 'Rebuild Workspace Index', category: 'Developer',
      handler: async () => {
        window.IntelliSenseEngine?.rebuildIndex?.();
        const root = window.explorerState?.rootPath;
        if (root && window.electronAPI?.nativeIndexWorkspace && window._noterSymbolDb) {
          window.toast?.('Rebuilding symbol index…', 'info');
          const count = await window.electronAPI.nativeIndexWorkspace(root, window._noterSymbolDb);
          window.toast?.(`Symbol index rebuilt — ${count} symbols`, 'success');
        }
      } },
    { id: 'workbench.clearCache', title: 'Clear Cache',          category: 'Developer',
      handler: () => {
        if (!confirm('Clear all cached data (settings and history will be preserved)?')) return;
        const keep = ['noter.settings.user','noter.settings.workspace','noter.keybindings','noter.settings.profile','noter.welcome.show'];
        Object.keys(localStorage).filter(k => k.startsWith('noter.') && !keep.includes(k)).forEach(k => localStorage.removeItem(k));
        window.toast?.('Cache cleared', 'info');
      } },

    // ── Debug (stub) ──────────────────────────────────────────────
    { id: 'debug.start',   title: 'Start Debugging',    category: 'Debug',
      handler: () => { window.toast?.('Debugger not available', 'info'); } },
    { id: 'debug.stop',    title: 'Stop Debugging',     category: 'Debug',
      handler: () => {} },
    { id: 'debug.stepOver',title: 'Step Over',          category: 'Debug', handler: () => {} },
    { id: 'debug.stepInto',title: 'Step Into',          category: 'Debug', handler: () => {} },
    { id: 'debug.stepOut', title: 'Step Out',           category: 'Debug', handler: () => {} },
    { id: 'debug.toggleBreakpoint', title: 'Toggle Breakpoint', category: 'Debug', handler: () => {} },

    // ── Help ──────────────────────────────────────────────────────
    { id: 'help.about',    title: 'About Noter',        category: 'Help',
      handler: () => { window.toast?.('Noter v2.0 — Electron + Monaco Editor', 'info'); } },
    { id: 'help.performance', title: 'Performance Monitor', category: 'Help',
      handler: () => window.PerformanceMonitor?.showDiagnostics?.() },
  ]);

  // Register Keyboard Shortcuts command here too as fallback
  if (!NoterCommands.has('workbench.keyboardShortcuts')) {
    NoterCommands.register({
      id: 'workbench.keyboardShortcuts', title: 'Keyboard Shortcuts',
      category: 'Workspace', handler: () => window.KeybindingsUI?.open?.(),
    });
  }
});

// ── Command Palette UI ────────────────────────────────────────
const CommandPalette = (() => {
  let _overlay = null;
  let _results = [];
  let _selIdx  = 0;
  let _built   = false;
  let _activeCategory = null;

  // ── Build DOM ─────────────────────────────────────────────────
  function _build() {
    if (_built) return;
    _built = true;

    _overlay = document.createElement('div');
    _overlay.id = 'cp-overlay';
    _overlay.innerHTML = `
      <div id="cp-box">
        <div id="cp-header">
          <span>⌘ Command Palette</span>
          <kbd>Esc to close</kbd>
        </div>
        <input id="cp-input" type="text" placeholder="Type a command… or # for workspace symbols"
               autocomplete="off" spellcheck="false"/>
        <div id="cp-cats"></div>
        <div id="cp-list"></div>
        <div id="cp-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>Enter</kbd> run</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>`;

    _overlay.addEventListener('mousedown', e => { if (e.target === _overlay) hide(); });
    _overlay.querySelector('#cp-input').addEventListener('input', _filter);
    _overlay.querySelector('#cp-input').addEventListener('keydown', _onKey);
    document.body.appendChild(_overlay);
  }

  // ── Render category pills ─────────────────────────────────────
  function _renderCats() {
    const cats = document.getElementById('cp-cats');
    if (!cats) return;
    const all = NoterCommands.getCategories();
    cats.innerHTML = `
      <span class="cp-cat-pill ${_activeCategory === null ? 'cp-cat-active' : ''}" data-cat="">All</span>
      ${all.map(c => `<span class="cp-cat-pill ${_activeCategory === c ? 'cp-cat-active' : ''}" data-cat="${c}">${c}</span>`).join('')}`;
    cats.querySelectorAll('.cp-cat-pill').forEach(pill =>
      pill.addEventListener('click', () => {
        _activeCategory = pill.dataset.cat || null;
        _filter();
        cats.querySelectorAll('.cp-cat-pill').forEach(p => p.classList.remove('cp-cat-active'));
        pill.classList.add('cp-cat-active');
        document.getElementById('cp-input')?.focus();
      })
    );
  }

  // ── Filter & render list ──────────────────────────────────────
  let _symbolMode = false;

  function _filter() {
    const q = document.getElementById('cp-input')?.value || '';

    // # prefix = Rust workspace symbol search
    if (q.startsWith('#')) {
      _symbolMode = true;
      _renderSymbolSearch(q.slice(1).trim());
      return;
    }
    _symbolMode = false;

    let results = NoterCommands.search(q);
    if (_activeCategory) results = results.filter(c => c.category === _activeCategory);
    _results = results;
    _selIdx  = 0;
    _renderList();
  }

  async function _renderSymbolSearch(query) {
    const list = document.getElementById('cp-list');
    if (!list) return;

    const db = window._noterSymbolDb;
    if (!db || !window.electronAPI?.nativeSearchSymbols) {
      list.innerHTML = `<div class="cp-empty">No symbol index — open a workspace first (index builds in ~2s)</div>`;
      return;
    }
    if (!query) {
      list.innerHTML = `<div class="cp-empty">Type a symbol name to search across workspace…</div>`;
      return;
    }

    list.innerHTML = `<div class="cp-empty">Searching symbols…</div>`;
    try {
      const symbols = await window.electronAPI.nativeSearchSymbols(db, query);
      _results = symbols.map(s => ({
        id:       `__sym__${s.file}:${s.line}`,
        title:    s.name,
        category: s.kind,
        _sym:     s,
      }));
      _selIdx = 0;

      if (!_results.length) {
        list.innerHTML = `<div class="cp-empty">No symbols match "${query}"</div>`;
        return;
      }

      list.innerHTML = _results.map((r, i) => `
        <div class="cp-item ${i === _selIdx ? 'cp-sel' : ''}" data-i="${i}">
          <span class="cp-label">${r.title}</span>
          <span class="cp-item-right">
            <span class="cp-item-cat">${r.category}</span>
            <span style="opacity:.5;font-size:.75em">${r._sym.file.split(/[\\/]/).pop()}:${r._sym.line}</span>
          </span>
        </div>`).join('');

      list.querySelectorAll('.cp-item').forEach(el => {
        el.addEventListener('mousedown', e => { e.preventDefault(); _runSymbol(+el.dataset.i); });
        el.addEventListener('mouseover', () => { _selIdx = +el.dataset.i; });
      });
      list.querySelector('.cp-sel')?.scrollIntoView({ block: 'nearest' });
    } catch (err) {
      list.innerHTML = `<div class="cp-empty">Symbol search error: ${err.message}</div>`;
    }
  }

  function _runSymbol(i) {
    const item = _results[i];
    if (!item?._sym) return;
    hide();
    const { file, line } = item._sym;
    setTimeout(async () => {
      let tab = window.TabManager?.tabs?.find(t => t.filePath === file);
      if (!tab) {
        const f = await window.electronAPI?.openFileByPath(file);
        if (!f) return;
        tab = window.TabManager?.create(f.filePath, f.content, f.filePath?.split('.').pop());
      }
      window.TabManager?.activate?.(tab.id);
      setTimeout(() => {
        window.editor?.revealLineInCenter(line);
        window.editor?.setPosition({ lineNumber: line, column: 1 });
        window.editor?.focus();
      }, 60);
    }, 30);
  }

  function _renderList() {
    const list = document.getElementById('cp-list');
    if (!list) return;

    if (!_results.length) {
      list.innerHTML = `<div class="cp-empty">No commands found</div>`;
      return;
    }

    // Group by category when no query
    const q = (document.getElementById('cp-input')?.value || '').trim();
    let html = '';

    if (!q && !_activeCategory) {
      // Show recently used first, then group rest
      const hist   = NoterCommands.getHistory();
      const recent = hist.map(id => _results.find(c => c.id === id)).filter(Boolean).slice(0, 5);
      const rest   = _results.filter(c => !recent.includes(c));

      if (recent.length) {
        html += `<div class="cp-group-label">Recently Used</div>`;
        html += recent.map((c, i) => _renderItem(c, i)).join('');
        if (rest.length) {
          html += `<div class="cp-group-label">All Commands</div>`;
          html += rest.map((c, i) => _renderItem(c, i + recent.length)).join('');
        }
      } else {
        const groups = {};
        for (const c of _results) (groups[c.category] = groups[c.category] || []).push(c);
        let idx = 0;
        for (const [cat, cmds] of Object.entries(groups)) {
          html += `<div class="cp-group-label">${cat}</div>`;
          html += cmds.map(c => _renderItem(c, idx++)).join('');
        }
      }
    } else {
      html = _results.map((c, i) => _renderItem(c, i)).join('');
    }

    list.innerHTML = html;

    list.querySelectorAll('.cp-item').forEach(el => {
      el.addEventListener('mousedown', e => { e.preventDefault(); _run(+el.dataset.i); });
      el.addEventListener('mouseover', () => { _selIdx = +el.dataset.i; _renderList(); });
    });

    list.querySelector('.cp-sel')?.scrollIntoView({ block: 'nearest' });
  }

  function _renderItem(cmd, i) {
    const key = window.NoterKeybindings?.getEffectiveKey?.(cmd.id) || '';
    return `<div class="cp-item ${i === _selIdx ? 'cp-sel' : ''}" data-i="${i}">
      <span class="cp-label">${cmd.title}</span>
      <span class="cp-item-right">
        ${cmd.category !== 'General' ? `<span class="cp-item-cat">${cmd.category}</span>` : ''}
        ${key ? `<kbd class="cp-shortcut">${key}</kbd>` : ''}
      </span>
    </div>`;
  }

  // ── Keyboard navigation ───────────────────────────────────────
  function _onKey(e) {
    if (e.key === 'Escape')    { hide(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); _selIdx = Math.min(_selIdx + 1, _results.length - 1); _renderList(); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); _selIdx = Math.max(_selIdx - 1, 0); _renderList(); }
    if (e.key === 'Enter')     { e.preventDefault(); _symbolMode ? _runSymbol(_selIdx) : _run(_selIdx); }
    if (e.key === 'Tab')       { e.preventDefault(); _selIdx = Math.min(_selIdx + 1, _results.length - 1); _renderList(); }
  }

  function _run(i) {
    const cmd = _results[i];
    if (!cmd) return;
    hide();
    setTimeout(() => NoterCommands.execute(cmd.id), 30);
  }

  // ── Show / Hide ───────────────────────────────────────────────
  function show() {
    _build();
    _overlay.classList.add('cp-visible');
    _activeCategory = null;
    document.getElementById('cp-input').value = '';
    _renderCats();
    _filter();
    document.getElementById('cp-input')?.focus();
  }

  function hide() {
    _overlay?.classList.remove('cp-visible');
    // Use the robust refocus helper if available, else fall back to editor.focus()
    setTimeout(() => (window._refocusEditor || (() => window.editor?.focus()))(), 30);
  }

  function toggle() {
    _overlay?.classList.contains('cp-visible') ? hide() : show();
  }

  // ── Document shortcut (when Monaco not focused) ───────────────
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
      e.preventDefault(); toggle();
    }
  });

  document.addEventListener('monaco-ready', () => {
    window.editor?.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP,
      () => toggle()
    );
  });

  return { show, hide, toggle };
})();

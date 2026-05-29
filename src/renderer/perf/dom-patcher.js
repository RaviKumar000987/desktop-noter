// ═══════════════════════════════════════════════════════════════
//  DOM PATCHER  — src/renderer/perf/dom-patcher.js
//  Keyed DOM diff utilities so we never rebuild the entire
//  tab list or scan all explorer rows on every state change.
//
//  Before: renderTabs() → list.innerHTML = ''  (destroy all, rebuild all)
//  After:  DomPatcher.patchTabs() → only add/remove/update changed tabs
//
//  Before: updateExplorerActiveFile() → querySelectorAll(...).forEach(...)
//  After:  ExplorerPathMap.setActive(path) → O(1) element lookup
// ═══════════════════════════════════════════════════════════════
'use strict';

// ── Tab list keyed patcher ────────────────────────────────────
window.TabPatcher = (() => {

  // Build a single tab DOM element (called only for NEW tabs)
  function _createEl(tab) {
    const el = document.createElement('div');
    el.className = 'tab-item';
    el.dataset.id = tab.id;
    el.title = tab.filePath || tab.title;
    el.draggable = true;

    // Modified dot
    const dot = document.createElement('span');
    dot.className = 'tab-modified-dot';
    dot.textContent = '●';
    dot.style.display = 'none';
    el.appendChild(dot);

    // Label
    const label = document.createElement('span');
    label.className = 'tab-label';
    el.appendChild(label);

    // Close button
    const close = document.createElement('button');
    close.className = 'tab-close';
    close.textContent = '×';
    close.title = 'Close tab';
    el.appendChild(close);

    return el;
  }

  // Update mutable parts of an existing element (cheaper than recreating)
  function _updateEl(el, tab, isActive, TabManagerRef, actionsRef) {
    el.title = tab.filePath || tab.title;
    el.classList.toggle('active', isActive);

    const dot = el.querySelector('.tab-modified-dot');
    if (dot) dot.style.display = tab.isModified ? '' : 'none';

    const label = el.querySelector('.tab-label');
    if (label && label.textContent !== tab.title) label.textContent = tab.title;
  }

  // Wire events ONCE when an element is created (not on every render)
  function _wireEvents(el, tab, TabManagerRef, actionsRef) {
    el.addEventListener('click', () => TabManagerRef.activate(tab.id));
    el.addEventListener('mousedown', (e) => {
      if (e.button === 1) { e.preventDefault(); TabManagerRef.close(tab.id); }
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault(); e.stopPropagation();
      // showTabContextMenu is a global in app.js
      if (typeof showTabContextMenu === 'function') {
        showTabContextMenu(tab, e.clientX, e.clientY);
      }
    });

    const close = el.querySelector('.tab-close');
    if (close) close.addEventListener('click', (e) => {
      e.stopPropagation();
      TabManagerRef.close(tab.id);
    });

    // Drag events (TabDnD is global in app.js)
    el.addEventListener('dragstart',  (e) => window.TabDnD?.onDragStart(e));
    el.addEventListener('dragover',   (e) => window.TabDnD?.onDragOver(e));
    el.addEventListener('dragleave',  (e) => window.TabDnD?.onDragLeave(e));
    el.addEventListener('drop',       (e) => window.TabDnD?.onDrop(e));
    el.addEventListener('dragend',    (e) => window.TabDnD?.onDragEnd(e));
  }

  // Main patch function — call instead of renderTabs()
  function patch(tabs, activeId) {
    const list = document.getElementById('tabs-list');
    if (!list) return;

    // Map of existing elements by tab id
    const existing = new Map();
    for (const el of list.querySelectorAll('.tab-item[data-id]')) {
      existing.set(el.dataset.id, el);
    }

    const keepIds = new Set(tabs.map(t => t.id));

    // Remove tabs that are gone
    for (const [id, el] of existing) {
      if (!keepIds.has(id)) el.remove();
    }

    // Insert/update in correct order
    let refNode = null; // next sibling insertion anchor
    for (const tab of tabs) {
      let el = existing.get(tab.id);
      const isNew = !el;

      if (isNew) {
        el = _createEl(tab);
        _wireEvents(el, tab, window.TabManager, window.actions);
      }

      _updateEl(el, tab, tab.id === activeId);

      // Maintain DOM order cheaply
      if (refNode === null) {
        if (list.firstChild !== el) list.prepend(el);
      } else {
        if (refNode.nextSibling !== el) refNode.after(el);
      }
      refNode = el;
    }

    // Scroll active tab into view
    const activeEl = list.querySelector('.tab-item.active');
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  return { patch };
})();


// ── Explorer active-file fast path ────────────────────────────
window.ExplorerPathMap = (() => {
  const _map = new Map(); // filePath → DOM element (.explorer-row)
  let _activePath = null;

  function register(filePath, el) {
    _map.set(filePath, el);
  }

  function unregister(filePath) {
    _map.delete(filePath);
  }

  function clear() {
    _map.clear();
    _activePath = null;
  }

  function setActive(filePath) {
    // Remove active class from previous
    if (_activePath && _activePath !== filePath) {
      const prev = _map.get(_activePath);
      if (prev) prev.classList.remove('active-file');
    }

    _activePath = filePath || null;

    if (!filePath) return;
    const el = _map.get(filePath);
    if (el) el.classList.add('active-file');
  }

  return { register, unregister, clear, setActive };
})();

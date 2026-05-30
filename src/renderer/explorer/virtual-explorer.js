// ═══════════════════════════════════════════════════════════════
//  NOTER VIRTUAL EXPLORER — src/renderer/explorer/virtual-explorer.js
//
//  Renders only the visible rows of the file tree (like VS Code's
//  explorer).  A workspace with 100,000 files renders ~40 DOM rows —
//  the rest lives in memory as a flat array.
//
//  Architecture:
//    _tree    — full flat list of visible (expanded) nodes
//    _visible — slice of _tree that fits the viewport
//    _pool    — recycled DOM row elements (object pool)
//
//  Usage:
//    VirtualExplorer.mount(containerEl);
//    VirtualExplorer.setTree(rootNodes);   // rootNodes: TreeNode[]
//    VirtualExplorer.setActive(path);
//    VirtualExplorer.refresh();
//    VirtualExplorer.destroy();
//
//  TreeNode shape:
//    { name, path, type: 'file'|'folder', depth, expanded?, children? }
// ═══════════════════════════════════════════════════════════════
'use strict';

window.VirtualExplorer = (() => {
  const ROW_HEIGHT   = 22;    // px — must match CSS
  const OVERSCAN     = 5;     // extra rows above/below viewport
  const POOL_SIZE    = 80;    // max recycled DOM rows

  let _container  = null;
  let _scrollEl   = null;     // the scrolling wrapper
  let _spacer     = null;     // top spacer (sets total scroll height)
  let _listEl     = null;     // holds the rendered rows

  let _tree       = [];       // flat expanded node list
  let _pool       = [];       // recycled row elements
  let _rowMap     = new Map();// path → row element (for active highlight)
  let _activePath = '';
  let _onOpen     = null;     // callback(node)
  let _onToggle   = null;     // callback(node)
  let _onContext  = null;     // callback(node, event)

  let _scrollRaf  = null;

  // ── DOM helpers ───────────────────────────────────────────────

  function _acquire() {
    return _pool.pop() || document.createElement('div');
  }

  function _release(el) {
    // Clone without children to strip ALL accumulated event listeners.
    // This is the critical pool-safety step — without it, a row previously
    // used for a file would carry its _handleOpen listener when reused for
    // a folder, causing both toggle AND open to fire on a single click.
    const fresh = el.cloneNode(false);
    fresh._node = null;
    if (_pool.length < POOL_SIZE) _pool.push(fresh);
  }

  // ── Row rendering ─────────────────────────────────────────────

  function _renderRow(node, top) {
    const el = _acquire();
    el._node = node;

    // Use 'explorer-row' class so existing context-menu.js + DnD still work
    const active = node.path === _activePath ? ' active-file' : '';
    el.className = `explorer-row vex-row${active}`;
    el.dataset.path = node.path;
    el.draggable    = true;
    el.style.cssText = `position:absolute;top:${top}px;left:0;right:0;height:${ROW_HEIGHT}px;display:flex;align-items:center;cursor:pointer;overflow:hidden;`;

    const indent = node.depth * 12;

    if (node.type === 'folder') {
      const arrow = node.expanded ? '▾' : '▸';
      // Hidden .explorer-toggle so context-menu.js isFolder check works
      el.innerHTML = `
        <span class="explorer-indent vex-indent" style="width:${indent}px"></span>
        <span class="explorer-toggle vex-arrow" style="margin-right:2px">${arrow}</span>
        <span class="explorer-file-icon" style="margin-right:4px">${node.expanded ? '📂' : '📁'}</span>
        <span class="explorer-name vex-name">${_esc(node.name)}</span>`;
      el.addEventListener('click', () => _handleToggle(node));
    } else {
      const color = _fileColor(node.name);
      el.innerHTML = `
        <span class="explorer-indent vex-indent" style="width:${indent + 18}px"></span>
        <span class="explorer-file-icon" style="color:${color};margin-right:4px">◦</span>
        <span class="explorer-name vex-name" style="color:${color}">${_esc(node.name)}</span>`;
      el.addEventListener('click', () => _handleOpen(node));
    }

    // Context menu: let event bubble to sidebar listener (context-menu.js),
    // but also call our own callback so callers can intercept.
    el.addEventListener('contextmenu', (e) => {
      _onContext?.(node, e);
    });

    // DnD events forwarded to ExplorerDnD if available
    el.addEventListener('dragstart', (e) =>
      window.ExplorerDnD?.onDragStart?.(e, node.path, node.type === 'folder' ? 'directory' : 'file'));
    el.addEventListener('dragend',   (e) => window.ExplorerDnD?.onDragEnd?.(e));
    el.addEventListener('dragover',  (e) => window.ExplorerDnD?.onDragOver?.(e, el));
    el.addEventListener('dragleave', (e) => window.ExplorerDnD?.onDragLeave?.(e, el));
    el.addEventListener('drop',      (e) => window.ExplorerDnD?.onDrop?.(e, el));

    _rowMap.set(node.path, el);
    return el;
  }

  function _esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _fileColor(name) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    const map = {
      js:'#f9e2af', ts:'#89b4fa', jsx:'#f9e2af', tsx:'#89b4fa',
      html:'#fab387', css:'#89dceb', scss:'#f5c2e7', json:'#a6e3a1',
      md:'#94e2d5', py:'#89b4fa', rs:'#fab387', go:'#89dceb',
      java:'#fab387', cpp:'#89b4fa', cs:'#a6e3a1', rb:'#f38ba8',
    };
    return map[ext] || '#7f849c';
  }

  // ── Flat tree builder ─────────────────────────────────────────

  function _flatten(nodes, depth = 0, out = []) {
    for (const node of nodes) {
      out.push({ ...node, depth });
      if (node.type === 'folder' && node.expanded && node.children?.length) {
        _flatten(node.children, depth + 1, out);
      }
    }
    return out;
  }

  // ── Viewport render ───────────────────────────────────────────

  function _render() {
    if (!_scrollEl) return;

    const scrollTop  = _scrollEl.scrollTop;
    const viewHeight = _scrollEl.clientHeight;
    const total      = _tree.length;

    const firstIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const lastIdx  = Math.min(total - 1, Math.ceil((scrollTop + viewHeight) / ROW_HEIGHT) + OVERSCAN);

    // Adjust spacer so scrollbar represents total height
    _spacer.style.height = `${total * ROW_HEIGHT}px`;

    // Recycle rows no longer in view
    const toRelease = [];
    for (const [path, el] of _rowMap) {
      const idx = _tree.findIndex(n => n.path === path);
      if (idx < firstIdx || idx > lastIdx) {
        toRelease.push([path, el]);
      }
    }
    for (const [path, el] of toRelease) {
      _rowMap.delete(path);
      el.remove();
      _release(el);
    }

    // Render rows now in view
    const fragment = document.createDocumentFragment();
    for (let i = firstIdx; i <= lastIdx; i++) {
      const node = _tree[i];
      if (_rowMap.has(node.path)) {
        // Update active state only
        const el = _rowMap.get(node.path);
        el.classList.toggle('vex-active', node.path === _activePath);
        continue;
      }
      const top = i * ROW_HEIGHT;
      const el  = _renderRow(node, top);
      fragment.appendChild(el);
    }
    _listEl.appendChild(fragment);
  }

  function _onScroll() {
    if (_scrollRaf) return;
    _scrollRaf = requestAnimationFrame(() => {
      _scrollRaf = null;
      _render();
    });
  }

  // ── Event handlers ────────────────────────────────────────────

  function _handleOpen(node) {
    setActive(node.path);
    _onOpen?.(node);
  }

  function _handleToggle(node) {
    // Do NOT toggle node.expanded here — node is a spread copy from _tree,
    // not the original in _vexRoots.  The onToggle callback (_vexToggleFolder)
    // is responsible for finding the original node and toggling it correctly,
    // then calling setTree() which will rebuild _tree with the right state.
    _onToggle?.(node);
  }

  // ── Public API ────────────────────────────────────────────────

  /** Mount VirtualExplorer into containerEl. */
  function mount(containerEl, { onOpen, onToggle, onContext } = {}) {
    _container = containerEl;
    _onOpen    = onOpen;
    _onToggle  = onToggle;
    _onContext = onContext;

    _scrollEl = document.createElement('div');
    _scrollEl.className  = 'vex-scroll';
    _scrollEl.style.cssText = 'overflow-y:auto;height:100%;position:relative;';

    _spacer = document.createElement('div');
    _spacer.className = 'vex-spacer';
    _spacer.style.cssText = 'position:relative;width:100%;';

    _listEl = document.createElement('div');
    _listEl.className   = 'vex-list';
    _listEl.style.cssText = 'position:absolute;top:0;left:0;right:0;';

    _spacer.appendChild(_listEl);
    _scrollEl.appendChild(_spacer);
    _container.appendChild(_scrollEl);

    _scrollEl.addEventListener('scroll', _onScroll, { passive: true });
  }

  /**
   * Set the root-level tree nodes (already containing children arrays).
   * Flattens and re-renders.
   */
  function setTree(rootNodes) {
    _tree = _flatten(rootNodes);
    // Clear all rows
    for (const el of _rowMap.values()) { el.remove(); _release(el); }
    _rowMap.clear();
    _render();
  }

  /** Mark a file path as active (highlighted). */
  function setActive(path) {
    const prev = _activePath;
    _activePath = path;
    // Update DOM for old + new active rows if visible
    if (prev && _rowMap.has(prev)) _rowMap.get(prev).classList.remove('vex-active');
    if (_rowMap.has(path))         _rowMap.get(path).classList.add('vex-active');
  }

  /** Rebuild flat list and re-render (e.g. after expand/collapse). */
  function refresh() {
    // Re-flatten from existing tree — but we need root nodes
    // _tree stores flat list; we rebuild from itself is complex.
    // Instead: caller passes rootNodes to setTree again.
    // This method is a viewport-only re-render for active path etc.
    for (const [, el] of _rowMap) {
      const node = el._node;
      if (!node) continue;
      el.classList.toggle('vex-active', node.path === _activePath);
    }
    _render();
  }

  /** Scroll the active file into view. */
  function revealActive() {
    const idx = _tree.findIndex(n => n.path === _activePath);
    if (idx < 0 || !_scrollEl) return;
    const top    = idx * ROW_HEIGHT;
    const bottom = top + ROW_HEIGHT;
    if (top < _scrollEl.scrollTop || bottom > _scrollEl.scrollTop + _scrollEl.clientHeight) {
      _scrollEl.scrollTop = top - _scrollEl.clientHeight / 2;
    }
  }

  /** Expand folders so that `path` is visible, then reveal it. */
  function expandTo(path, rootNodes) {
    function _expand(nodes) {
      for (const node of nodes) {
        if (path.startsWith(node.path)) {
          node.expanded = true;
          if (node.children) _expand(node.children);
        }
      }
    }
    _expand(rootNodes);
    setTree(rootNodes);
    setActive(path);
    revealActive();
  }

  /** Tear down — remove DOM, clear pool. */
  function destroy() {
    if (_scrollEl) {
      _scrollEl.removeEventListener('scroll', _onScroll);
      _scrollEl.remove();
    }
    _rowMap.clear();
    _pool   = [];
    _tree   = [];
    _scrollEl = _spacer = _listEl = _container = null;
  }

  function getStats() {
    return { total: _tree.length, rendered: _rowMap.size, pooled: _pool.length };
  }

  return { mount, setTree, setActive, refresh, revealActive, expandTo, destroy, getStats };
})();

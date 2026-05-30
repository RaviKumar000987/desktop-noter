// ═══════════════════════════════════════════════════════════════
//  COMMAND REGISTRY — command-registry.js
//  Central store for ALL commands: palette, menu, keybindings.
//  Extensions call NoterCommands.register(...) to add commands.
//  Load FIRST — before app.js and all feature modules.
// ═══════════════════════════════════════════════════════════════

window.NoterCommands = (() => {
  const _registry = new Map();
  const _history  = [];
  const MAX_HIST  = 50;

  // ── Register ──────────────────────────────────────────────────
  function register(opts) {
    const { id, title, category = 'General', description = '', icon = '',
            aliases = [], when, handler } = opts;
    if (!id || !title || typeof handler !== 'function') return;
    _registry.set(id, {
      id, title, category, description, icon,
      aliases: Array.isArray(aliases) ? aliases : [aliases],
      when: when || null, handler,
    });
  }

  function registerMany(list) { list.forEach(register); }
  function unregister(id)     { _registry.delete(id); }

  // ── Execute ───────────────────────────────────────────────────
  function execute(id, ...args) {
    const cmd = _registry.get(id);
    if (!cmd) {
      console.warn('[NoterCommands] Unknown command:', id);
      window.toast?.(`Unknown command: ${id}`, 'error', 2500);
      return;
    }
    _addHistory(id);
    try {
      const result = cmd.handler(...args);
      // Catch async handler rejections
      if (result && typeof result.then === 'function') {
        result.catch(e => {
          console.error('[NoterCommands] Async error in', id, e);
          window.toast?.(`Command failed: ${cmd.title} — ${e?.message || e}`, 'error', 3500);
        });
      }
      return result;
    } catch (e) {
      console.error('[NoterCommands] Error in', id, e);
      window.toast?.(`Command failed: ${cmd.title} — ${e?.message || e}`, 'error', 3500);
    }
  }

  // ── Search (fuzzy + history-weighted) ────────────────────────
  function search(query, context) {
    const q   = (query || '').toLowerCase().trim();
    const all = getAll().filter(c => _matchWhen(c, context));
    if (!q) return [...all].sort((a, b) => _histScore(b.id) - _histScore(a.id));
    return all
      .map(c => ({ c, s: _score(c, q) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map(x => x.c);
  }

  function _score(cmd, q) {
    const t = cmd.title.toLowerCase();
    const h = _histScore(cmd.id);
    if (t === q)             return 9000 + h;
    if (t.startsWith(q))    return 5000 + h;
    if (t.includes(q))      return 2000 + h;
    if (cmd.description.toLowerCase().includes(q)) return 1800 + h;
    if (cmd.aliases.some(a => a.toLowerCase().includes(q))) return 1500 + h;
    // Fuzzy: all query chars appear in order in title
    let qi = 0;
    for (let i = 0; i < t.length && qi < q.length; i++) {
      if (t[i] === q[qi]) qi++;
    }
    if (qi === q.length) return 100 + h - Math.max(0, t.length - q.length);
    if (cmd.category.toLowerCase().includes(q)) return 50 + h;
    return 0;
  }

  function _matchWhen(cmd, ctx) {
    if (!cmd.when || !ctx) return true;
    try { return cmd.when(ctx); } catch { return true; }
  }

  // ── Accessors ─────────────────────────────────────────────────
  function getAll() { return [..._registry.values()]; }
  function get(id)  { return _registry.get(id) || null; }
  function has(id)  { return _registry.has(id); }

  function getHistory() { return [..._history]; }

  function getCategories() {
    return [...new Set([..._registry.values()].map(c => c.category))].sort();
  }

  function getByCategory(cat) {
    return getAll().filter(c => c.category === cat);
  }

  // ── History ───────────────────────────────────────────────────
  function _histScore(id) {
    const i = _history.indexOf(id);
    return i === -1 ? 0 : MAX_HIST - i;
  }

  function _addHistory(id) {
    const i = _history.indexOf(id);
    if (i > -1) _history.splice(i, 1);
    _history.unshift(id);
    if (_history.length > MAX_HIST) _history.length = MAX_HIST;
    try { localStorage.setItem('noter.cmd.hist', JSON.stringify(_history)); } catch {}
  }

  (function _loadHistory() {
    try {
      const h = JSON.parse(localStorage.getItem('noter.cmd.hist') || '[]');
      _history.push(...h.slice(0, MAX_HIST));
    } catch {}
  })();

  return {
    register, registerMany, unregister,
    execute,
    search, getAll, get, has, getHistory, getCategories, getByCategory,
  };
})();

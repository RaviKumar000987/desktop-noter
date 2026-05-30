// ═══════════════════════════════════════════════════════════════
//  DIAGNOSTIC STORE — src/renderer/editor/diagnostic-store.js
//
//  Single source of truth for all LSP diagnostics.
//  Week 3 prep: decoupled from LspClient so multiple consumers
//  (Problems Panel, Code Actions, AI Engine, Error Lens) can
//  subscribe without coupling to LspClient internals.
//
//  Consumers:
//    window.DiagnosticStore.get(uri)        → LSP diagnostics[]
//    window.DiagnosticStore.getMarkers(uri) → Monaco MarkerData[]
//    window.DiagnosticStore.getAll()        → flat {uri, ...diag}[]
//    window.DiagnosticStore.onUpdate(cb)    → subscribe to changes
// ═══════════════════════════════════════════════════════════════
'use strict';

window.DiagnosticStore = (() => {

  // uri → { lsp: Diagnostic[], markers: MarkerData[] }
  const _store       = new Map();
  const _subscribers = new Set();

  // ── LSP severity → Monaco MarkerSeverity ─────────────────────
  // LSP: 1=Error, 2=Warning, 3=Information, 4=Hint
  // Monaco: Error=8, Warning=4, Info=2, Hint=1
  const LSP_TO_MONACO_SEV = { 1: 8, 2: 4, 3: 2, 4: 1 };

  function _toMarkers(lspDiagnostics) {
    return lspDiagnostics.map(d => ({
      severity:        LSP_TO_MONACO_SEV[d.severity] ?? 4,
      startLineNumber: d.range.start.line + 1,
      startColumn:     d.range.start.character + 1,
      endLineNumber:   d.range.end.line + 1,
      endColumn:       d.range.end.character + 1,
      message:         d.message,
      source:          d.source ?? 'lsp',
      code:            d.code?.toString(),
      relatedInformation: (d.relatedInformation ?? []).map(r => ({
        startLineNumber: r.location.range.start.line + 1,
        startColumn:     r.location.range.start.character + 1,
        endLineNumber:   r.location.range.end.line + 1,
        endColumn:       r.location.range.end.character + 1,
        message:         r.message,
        resource:        typeof monaco !== 'undefined'
          ? monaco.Uri.parse(r.location.uri)
          : undefined,
      })),
    }));
  }

  function _notify(uri, markers) {
    for (const cb of _subscribers) {
      try { cb({ uri, markers }); } catch {}
    }
    document.dispatchEvent(new CustomEvent('lsp:diagnostics-updated', {
      detail: { uri, markers },
    }));
  }

  // Normalize URI for model lookup — tsserver uses percent-encoded lowercase URIs
  // (e.g. file:///e%3A/path) while Monaco may use different casing/encoding.
  // Decode both sides before comparing.
  function _findModel(uri) {
    if (typeof monaco === 'undefined') return null;
    const decoded = decodeURIComponent(uri).toLowerCase();
    return monaco.editor.getModels().find(m => {
      return decodeURIComponent(m.uri.toString()).toLowerCase() === decoded;
    }) ?? null;
  }

  // ── Write ─────────────────────────────────────────────────────
  function set(uri, lspDiagnostics) {
    const markers = _toMarkers(lspDiagnostics);
    _store.set(uri, { lsp: lspDiagnostics, markers });

    // Apply to Monaco model — normalized URI comparison handles encoding differences
    const model = _findModel(uri);
    if (model) monaco.editor.setModelMarkers(model, 'lsp', markers);

    _notify(uri, markers);
  }

  function clear(uri) {
    _store.delete(uri);
    const model = _findModel(uri);
    if (model) monaco.editor.setModelMarkers(model, 'lsp', []);
    _notify(uri, []);
  }

  // ── Read ──────────────────────────────────────────────────────
  function get(uri) {
    return _store.get(uri)?.lsp ?? [];
  }

  function getMarkers(uri) {
    return _store.get(uri)?.markers ?? [];
  }

  function getAll() {
    const out = [];
    for (const [uri, { lsp }] of _store) {
      for (const d of lsp) out.push({ uri, ...d });
    }
    return out;
  }

  function getAllMarkers() {
    const out = new Map();
    for (const [uri, { markers }] of _store) {
      if (markers.length) out.set(uri, markers);
    }
    return out;
  }

  function counts() {
    let errors = 0, warnings = 0, infos = 0;
    for (const { lsp } of _store.values()) {
      for (const d of lsp) {
        if (d.severity === 1) errors++;
        else if (d.severity === 2) warnings++;
        else infos++;
      }
    }
    return { errors, warnings, infos };
  }

  // ── Subscribe ─────────────────────────────────────────────────
  function onUpdate(cb) {
    _subscribers.add(cb);
    return () => _subscribers.delete(cb);
  }

  // Re-apply all stored markers when a new Monaco model is created
  // (e.g., user switches to a tab that already had diagnostics)
  if (typeof document !== 'undefined') {
    document.addEventListener('monaco-model-created', (e) => {
      const uri  = e.detail?.uri;
      const data = _store.get(uri);
      if (!data || !data.markers.length) return;
      const model = _findModel(uri);
      if (model) monaco.editor.setModelMarkers(model, 'lsp', data.markers);
    });
  }

  return { set, clear, get, getMarkers, getAll, getAllMarkers, counts, onUpdate };
})();

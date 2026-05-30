// ═══════════════════════════════════════════════════════════════
//  COMPLETION NORMALIZER — src/renderer/editor/completion-normalizer.js
//
//  The normalize-once layer between LSP and Monaco.
//
//  Problem it solves:
//    tsserver, pyright, clangd, rust-analyzer all emit slightly
//    different CompletionItem shapes. Direct LSP→Monaco mapping
//    in each provider = per-server bugs forever.
//
//  Solution:
//    LSP CompletionItem → NoterCompletionItem (normalized)
//                       → Monaco CompletionItem (display)
//
//  When AI completion ships in Phase 2, it produces NoterCompletionItems
//  directly — no LSP in the middle. Monaco never knows the difference.
// ═══════════════════════════════════════════════════════════════
'use strict';

window.CompletionNormalizer = (() => {

  // ── NoterCompletionKind — our canonical kind set ──────────────
  const Kind = Object.freeze({
    Text:          'text',
    Method:        'method',
    Function:      'function',
    Constructor:   'constructor',
    Field:         'field',
    Variable:      'variable',
    Class:         'class',
    Interface:     'interface',
    Module:        'module',
    Property:      'property',
    Unit:          'unit',
    Value:         'value',
    Enum:          'enum',
    Keyword:       'keyword',
    Snippet:       'snippet',
    Color:         'color',
    File:          'file',
    Reference:     'reference',
    Folder:        'folder',
    EnumMember:    'enumMember',
    Constant:      'constant',
    Struct:        'struct',
    Event:         'event',
    Operator:      'operator',
    TypeParameter: 'typeParameter',
  });

  // ── LSP CompletionItemKind (1-25) → NoterCompletionKind ──────
  const FROM_LSP_KIND = {
    1:  Kind.Text,          2:  Kind.Method,
    3:  Kind.Function,      4:  Kind.Constructor,
    5:  Kind.Field,         6:  Kind.Variable,
    7:  Kind.Class,         8:  Kind.Interface,
    9:  Kind.Module,        10: Kind.Property,
    11: Kind.Unit,          12: Kind.Value,
    13: Kind.Enum,          14: Kind.Keyword,
    15: Kind.Snippet,       16: Kind.Color,
    17: Kind.File,          18: Kind.Reference,
    19: Kind.Folder,        20: Kind.EnumMember,
    21: Kind.Constant,      22: Kind.Struct,
    23: Kind.Event,         24: Kind.Operator,
    25: Kind.TypeParameter,
  };

  // ── NoterCompletionKind → Monaco CompletionItemKind ──────────
  // Monaco 0.55 CompletionItemKind enum values:
  const TO_MONACO_KIND = {
    method:        0,   function:  1,   constructor: 2,
    field:         3,   variable:  4,   class:       5,
    struct:        6,   interface: 7,   module:      8,
    property:      9,   event:     10,  operator:    11,
    unit:          12,  value:     13,  constant:    14,
    enum:          15,  enumMember:16,  keyword:     17,
    text:          18,  color:     19,  file:        20,
    reference:     21,  folder:    23,  typeParameter:24,
    snippet:       25,
  };

  // ── Recent-use tracking (LRU, max 50 labels) ─────────────────
  // Future: persist to localStorage per workspace
  const _recent = new Map(); // label → Date.now()
  const RECENT_MAX = 50;

  function recordUsed(label) {
    _recent.delete(label);       // bump to front
    _recent.set(label, Date.now());
    if (_recent.size > RECENT_MAX) {
      // evict oldest
      _recent.delete(_recent.keys().next().value);
    }
  }

  function recentScore(label) {
    const ts = _recent.get(label);
    if (!ts) return 0;
    // Decay over 30 minutes: 1.0 → 0.0
    const age = (Date.now() - ts) / (30 * 60 * 1000);
    return Math.max(0, 1 - age) * 30;
  }

  // ── Ranking ───────────────────────────────────────────────────
  function _prefixScore(label, prefix) {
    if (!prefix) return 5;
    const l = label.toLowerCase();
    const p = prefix.toLowerCase();
    if (l === p)           return 100;
    if (l.startsWith(p))   return 60;
    if (l.includes(p))     return 20;
    return 0;
  }

  function _serverSortScore(sortText) {
    // tsserver uses '0000...' → '9999...' to indicate internal priority.
    // Convert to 0-10 additive bonus.
    if (!sortText) return 5;
    const first = sortText.charCodeAt(0);
    if (first >= 48 && first <= 57) return Math.max(0, 10 - (first - 48));
    return 5;
  }

  // Exposed so provider can call this before building Monaco suggestions.
  function rankItems(noterItems, prefix) {
    return noterItems
      .map(item => ({
        ...item,
        _totalScore:
          _prefixScore(item.label, prefix) +
          recentScore(item.label) +
          _serverSortScore(item.sortText) +
          (item.preselect ? 20 : 0),
      }))
      .sort((a, b) => b._totalScore - a._totalScore);
  }

  // ── LSP → NoterCompletionItem ─────────────────────────────────
  function fromLsp(lspItem, source = 'unknown') {
    const insertText = lspItem.textEdit?.newText ?? lspItem.insertText ?? lspItem.label;
    const docStr = (() => {
      if (!lspItem.documentation) return undefined;
      if (typeof lspItem.documentation === 'string') return lspItem.documentation;
      return lspItem.documentation?.value;
    })();

    return {
      // Core display
      label:      lspItem.label,
      kind:       FROM_LSP_KIND[lspItem.kind] ?? Kind.Text,
      detail:     lspItem.detail ?? '',
      documentation: docStr,

      // Insert
      insertText,
      isSnippet:  !!(lspItem.insertTextFormat === 2 || insertText?.includes('${')),

      // Ranking inputs
      sortText:   lspItem.sortText ?? lspItem.label,
      filterText: lspItem.filterText ?? lspItem.label,
      preselect:  lspItem.preselect ?? false,

      // Multi-file edits
      additionalTextEdits: lspItem.additionalTextEdits ?? [],

      // Commit characters
      commitCharacters: lspItem.commitCharacters ?? [],

      // Source + raw LSP data (for completionItem/resolve)
      source,
      _lspItem: lspItem,
      _resolved: !lspItem.data,   // no data = nothing to resolve
    };
  }

  // ── NoterCompletionItem → Monaco CompletionItem ───────────────
  function toMonaco(noterItem, range) {
    const item = {
      label:       noterItem.label,
      kind:        TO_MONACO_KIND[noterItem.kind] ?? 18,
      detail:      noterItem.detail,
      documentation: noterItem.documentation
        ? { value: noterItem.documentation }
        : undefined,
      insertText:  noterItem.insertText,
      insertTextRules: noterItem.isSnippet
        ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
        : undefined,
      sortText:    noterItem.sortText,
      filterText:  noterItem.filterText,
      preselect:   noterItem.preselect,
      commitCharacters: noterItem.commitCharacters,
      range,
      additionalTextEdits: noterItem.additionalTextEdits.map(e => ({
        range: {
          startLineNumber: e.range.start.line + 1, startColumn: e.range.start.character + 1,
          endLineNumber:   e.range.end.line + 1,   endColumn:   e.range.end.character + 1,
        },
        text: e.newText,
      })),
      // Carry through for resolveCompletionItem
      _noterItem: noterItem,
    };
    return item;
  }

  // ── completionItem/resolve ────────────────────────────────────
  // Called by Monaco when the user highlights an item in the widget.
  // Fetches full documentation from the server (the initial list often
  // omits docs for performance — this is the "expand on demand" step).
  async function resolve(monacoItem, serverId) {
    const noterItem = monacoItem._noterItem;
    if (!noterItem || noterItem._resolved) return monacoItem;
    if (!noterItem._lspItem?.data)          return monacoItem;

    try {
      const { result } = await window.electronAPI.lspRequest(
        serverId, 'completionItem/resolve', noterItem._lspItem
      );
      if (!result) return monacoItem;

      noterItem._resolved = true;

      // Merge resolved documentation
      const doc = result.documentation;
      if (doc) {
        monacoItem.documentation = {
          value: typeof doc === 'string' ? doc : doc.value ?? '',
        };
      }
      // Merge resolved detail
      if (result.detail) monacoItem.detail = result.detail;
    } catch { /* resolve is best-effort — never block the widget */ }

    return monacoItem;
  }

  return { Kind, fromLsp, toMonaco, rankItems, resolve, recordUsed };
})();

// ═══════════════════════════════════════════════════════════════
//  LSP CLIENT — src/renderer/editor/lsp-client.js
//  Bridges Monaco editor with Language Server Protocol servers.
//  Connects pyright (Python), clangd (C/C++), jdtls (Java).
//  TypeScript/JS uses Monaco's built-in TS service (no external server).
//
//  Requires: monaco-ready event + window.electronAPI.lspXxx methods
// ═══════════════════════════════════════════════════════════════
'use strict';

window.LspClient = (() => {

  // ── Server state ──────────────────────────────────────────────
  const _servers   = {};   // serverId → { state, capabilities }
  const _openDocs  = new Map(); // uri → { version, languageId }
  const _diagStore = new Map(); // uri → MarkerData[]

  // Language → server mapping
  const LANG_SERVER = {
    python:   'pyright',
    c:        'clangd',
    cpp:      'clangd',
    java:     'jdtls',
  };

  // ── Lifecycle: start all available servers ────────────────────
  async function init() {
    if (!window.electronAPI?.lspDetect) return;

    const available = await window.electronAPI.lspDetect().catch(() => ({}));
    for (const [id, found] of Object.entries(available)) {
      if (found) await _startServer(id).catch(() => {});
    }

    // Listen for server-to-renderer notifications
    window.electronAPI.onLspMessage(_onServerMessage);
    window.electronAPI.onLspServerStatus((status) => {
      if (_servers[status.id]) _servers[status.id].state = status.state;
      _notifyStatusChange();
    });
  }

  async function _startServer(serverId) {
    const result = await window.electronAPI.lspStart(serverId);
    if (!result.ok) return;

    if (result.builtin) {
      _servers[serverId] = { state: 'builtin', capabilities: {} };
      return;
    }

    _servers[serverId] = { state: 'starting', capabilities: {} };

    // LSP Initialize handshake
    const rootUri = _getWorkspaceUri();
    try {
      const caps = await window.electronAPI.lspRequest(serverId, 'initialize', {
        processId:    null,
        clientInfo:   { name: 'noter', version: '2.0' },
        locale:       'en',
        rootUri,
        workspaceFolders: rootUri ? [{ uri: rootUri, name: 'workspace' }] : null,
        capabilities: _clientCapabilities(),
        initializationOptions: serverId === 'pyright' ? { pythonPath: null } : undefined,
      });

      await window.electronAPI.lspNotify(serverId, 'initialized', {});
      _servers[serverId] = { state: 'running', capabilities: caps?.capabilities || {} };
      _notifyStatusChange();

      // Re-open any already-open documents
      for (const [uri, info] of _openDocs) {
        const content = _getDocContent(uri);
        if (content !== null) {
          window.electronAPI.lspNotify(serverId, 'textDocument/didOpen', {
            textDocument: { uri, languageId: info.languageId, version: info.version, text: content },
          });
        }
      }
    } catch (err) {
      console.warn(`[LSP:${serverId}] initialize failed:`, err.message);
      _servers[serverId] = { state: 'error', capabilities: {} };
    }
  }

  // ── Document synchronization ──────────────────────────────────
  function onDocumentOpen(uri, languageId, text, version = 1) {
    _openDocs.set(uri, { version, languageId });
    const serverId = LANG_SERVER[languageId];
    if (!serverId || _servers[serverId]?.state !== 'running') return;
    window.electronAPI.lspNotify(serverId, 'textDocument/didOpen', {
      textDocument: { uri, languageId, version, text },
    });
  }

  function onDocumentChange(uri, text, version) {
    const info = _openDocs.get(uri);
    if (!info) return;
    info.version = version;
    const serverId = LANG_SERVER[info.languageId];
    if (!serverId || _servers[serverId]?.state !== 'running') return;
    // Send incremental or full sync
    window.electronAPI.lspNotify(serverId, 'textDocument/didChange', {
      textDocument:   { uri, version },
      contentChanges: [{ text }], // full sync (simpler, always correct)
    });
  }

  function onDocumentClose(uri) {
    const info = _openDocs.get(uri);
    _openDocs.delete(uri);
    if (!info) return;
    const serverId = LANG_SERVER[info.languageId];
    if (!serverId || _servers[serverId]?.state !== 'running') return;
    window.electronAPI.lspNotify(serverId, 'textDocument/didClose', {
      textDocument: { uri },
    });
  }

  // ── Handle server → client messages ──────────────────────────
  function _onServerMessage({ server, message }) {
    // Diagnostics notification
    if (message.method === 'textDocument/publishDiagnostics') {
      _handleDiagnostics(message.params);
    }
    // Window messages (logs, progress)
    if (message.method === 'window/logMessage' || message.method === 'window/showMessage') {
      console.log(`[LSP:${server}]`, message.params?.message);
    }
  }

  function _handleDiagnostics({ uri, diagnostics }) {
    if (typeof monaco === 'undefined') return;
    const model = monaco.editor.getModels().find(m => m.uri.toString() === uri);
    if (!model) { _diagStore.set(uri, diagnostics); return; }

    const markers = diagnostics.map(d => ({
      severity:        _lspSeverity(d.severity),
      startLineNumber: d.range.start.line + 1,
      startColumn:     d.range.start.character + 1,
      endLineNumber:   d.range.end.line + 1,
      endColumn:       d.range.end.character + 1,
      message:         d.message,
      source:          d.source || 'lsp',
      code:            d.code?.toString(),
    }));

    monaco.editor.setModelMarkers(model, 'lsp', markers);
    _diagStore.set(uri, diagnostics);
    document.dispatchEvent(new CustomEvent('lsp:diagnostics-updated', { detail: { uri, markers } }));
  }

  function _lspSeverity(s) {
    // 1=Error, 2=Warning, 3=Information, 4=Hint
    const MAP = { 1: 8, 2: 4, 3: 2, 4: 1 }; // monaco MarkerSeverity
    return MAP[s] || 4;
  }

  // ── Monaco completion provider for LSP ───────────────────────
  function _registerCompletionProvider(languageId, serverId) {
    if (typeof monaco === 'undefined') return;
    monaco.languages.registerCompletionItemProvider(languageId, {
      triggerCharacters: ['.', '(', ',', ' ', '<', '"', "'", '/', '@', '#', ':'],
      async provideCompletionItems(model, position, context) {
        if (_servers[serverId]?.state !== 'running') return { suggestions: [] };
        const uri = model.uri.toString();
        try {
          const { result, error } = await window.electronAPI.lspRequest(serverId, 'textDocument/completion', {
            textDocument: { uri },
            position:     { line: position.lineNumber - 1, character: position.column - 1 },
            context:      { triggerKind: context.triggerKind, triggerCharacter: context.triggerCharacter },
          });
          if (error || !result) return { suggestions: [] };

          const items = Array.isArray(result) ? result : (result.items || []);
          const word  = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
            startColumn: word.startColumn, endColumn: word.endColumn,
          };
          return {
            suggestions: items.map(item => _lspCompletionToMonaco(item, range)),
            incomplete: result.isIncomplete || false,
          };
        } catch { return { suggestions: [] }; }
      },
    });
  }

  function _lspCompletionToMonaco(item, range) {
    const KIND_MAP = {
      1: 17, 2: 2, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6,
      8: 7, 9: 8, 10: 9, 11: 4, 12: 11, 13: 12,
      14: 13, 15: 14, 16: 15, 17: 16, 18: 17, 19: 18,
      20: 19, 21: 1, 22: 10, 23: 20, 24: 21, 25: 2,
    };
    const insertText = item.textEdit?.newText || item.insertText || item.label;
    return {
      label:       item.label,
      kind:        KIND_MAP[item.kind] || 1,
      detail:      item.detail || '',
      documentation: item.documentation
        ? { value: typeof item.documentation === 'string' ? item.documentation : item.documentation.value }
        : undefined,
      insertText,
      insertTextRules: insertText?.includes('${')
        ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
        : undefined,
      sortText:    item.sortText || item.label,
      filterText:  item.filterText || item.label,
      preselect:   item.preselect || false,
      range,
      additionalTextEdits: item.additionalTextEdits?.map(e => ({
        range: _lspRangeToMonaco(e.range),
        text:  e.newText,
      })),
    };
  }

  // ── Monaco hover provider for LSP ────────────────────────────
  function _registerHoverProvider(languageId, serverId) {
    if (typeof monaco === 'undefined') return;
    monaco.languages.registerHoverProvider(languageId, {
      async provideHover(model, position) {
        if (_servers[serverId]?.state !== 'running') return null;
        const uri = model.uri.toString();
        try {
          const { result } = await window.electronAPI.lspRequest(serverId, 'textDocument/hover', {
            textDocument: { uri },
            position:     { line: position.lineNumber - 1, character: position.column - 1 },
          });
          if (!result?.contents) return null;
          const value = Array.isArray(result.contents)
            ? result.contents.map(c => typeof c === 'string' ? c : c.value).join('\n\n')
            : typeof result.contents === 'string' ? result.contents : result.contents.value;
          return {
            contents: [{ value }],
            range: result.range ? _lspRangeToMonaco(result.range) : undefined,
          };
        } catch { return null; }
      },
    });
  }

  // ── Definition provider ───────────────────────────────────────
  function _registerDefinitionProvider(languageId, serverId) {
    if (typeof monaco === 'undefined') return;
    monaco.languages.registerDefinitionProvider(languageId, {
      async provideDefinition(model, position) {
        if (_servers[serverId]?.state !== 'running') return null;
        try {
          const { result } = await window.electronAPI.lspRequest(serverId, 'textDocument/definition', {
            textDocument: { uri: model.uri.toString() },
            position:     { line: position.lineNumber - 1, character: position.column - 1 },
          });
          if (!result) return null;
          const locs = Array.isArray(result) ? result : [result];
          return locs.map(loc => ({
            uri:   monaco.Uri.parse(loc.uri),
            range: _lspRangeToMonaco(loc.range),
          }));
        } catch { return null; }
      },
    });
  }

  // ── References provider ───────────────────────────────────────
  function _registerReferencesProvider(languageId, serverId) {
    if (typeof monaco === 'undefined') return;
    monaco.languages.registerReferenceProvider(languageId, {
      async provideReferences(model, position, ctx) {
        if (_servers[serverId]?.state !== 'running') return null;
        try {
          const { result } = await window.electronAPI.lspRequest(serverId, 'textDocument/references', {
            textDocument: { uri: model.uri.toString() },
            position:     { line: position.lineNumber - 1, character: position.column - 1 },
            context:      { includeDeclaration: ctx.includeDeclaration },
          });
          return (result || []).map(loc => ({
            uri:   monaco.Uri.parse(loc.uri),
            range: _lspRangeToMonaco(loc.range),
          }));
        } catch { return null; }
      },
    });
  }

  // ── Rename provider ───────────────────────────────────────────
  function _registerRenameProvider(languageId, serverId) {
    if (typeof monaco === 'undefined') return;
    monaco.languages.registerRenameProvider(languageId, {
      async provideRenameEdits(model, position, newName) {
        if (_servers[serverId]?.state !== 'running') return null;
        try {
          const { result } = await window.electronAPI.lspRequest(serverId, 'textDocument/rename', {
            textDocument: { uri: model.uri.toString() },
            position:     { line: position.lineNumber - 1, character: position.column - 1 },
            newName,
          });
          if (!result) return null;
          const edits = [];
          for (const [uri, fileEdits] of Object.entries(result.changes || {})) {
            for (const edit of fileEdits) {
              edits.push({ resource: monaco.Uri.parse(uri), edit: { range: _lspRangeToMonaco(edit.range), text: edit.newText } });
            }
          }
          return { edits };
        } catch { return null; }
      },
    });
  }

  // ── Signature help provider ───────────────────────────────────
  function _registerSignatureProvider(languageId, serverId) {
    if (typeof monaco === 'undefined') return;
    monaco.languages.registerSignatureHelpProvider(languageId, {
      signatureHelpTriggerCharacters:   ['(', ','],
      signatureHelpRetriggerCharacters: [')'],
      async provideSignatureHelp(model, position) {
        if (_servers[serverId]?.state !== 'running') return null;
        try {
          const { result } = await window.electronAPI.lspRequest(serverId, 'textDocument/signatureHelp', {
            textDocument: { uri: model.uri.toString() },
            position:     { line: position.lineNumber - 1, character: position.column - 1 },
          });
          if (!result?.signatures?.length) return null;
          return {
            value: {
              signatures:      result.signatures.map(s => ({
                label:         s.label,
                documentation: s.documentation ? { value: typeof s.documentation === 'string' ? s.documentation : s.documentation.value } : undefined,
                parameters:    (s.parameters || []).map(p => ({
                  label:         p.label,
                  documentation: p.documentation ? { value: typeof p.documentation === 'string' ? p.documentation : p.documentation.value } : undefined,
                })),
              })),
              activeSignature: result.activeSignature || 0,
              activeParameter: result.activeParameter || 0,
            },
            dispose() {},
          };
        } catch { return null; }
      },
    });
  }

  // ── Register all Monaco providers for a language+server ──────
  function _registerProviders(languageId, serverId) {
    _registerCompletionProvider(languageId, serverId);
    _registerHoverProvider(languageId, serverId);
    _registerDefinitionProvider(languageId, serverId);
    _registerReferencesProvider(languageId, serverId);
    _registerRenameProvider(languageId, serverId);
    _registerSignatureProvider(languageId, serverId);
  }

  // ── Helpers ───────────────────────────────────────────────────
  function _lspRangeToMonaco(r) {
    return {
      startLineNumber: r.start.line + 1, startColumn: r.start.character + 1,
      endLineNumber:   r.end.line + 1,   endColumn:   r.end.character + 1,
    };
  }

  function _getWorkspaceUri() {
    const root = window.workspaceRoot || window.currentWorkspace;
    if (!root) return null;
    return 'file:///' + root.replace(/\\/g, '/');
  }

  function _getDocContent(uri) {
    if (typeof TabManager === 'undefined') return null;
    for (const tab of (TabManager.getAll?.() || TabManager.tabs || [])) {
      if (tab.model && tab.model.uri.toString() === uri) return tab.model.getValue();
    }
    return null;
  }

  function _clientCapabilities() {
    return {
      textDocument: {
        synchronization:   { willSave: false, didSave: false, dynamicRegistration: false },
        completion:        { completionItem: { snippetSupport: true, documentationFormat: ['markdown','plaintext'], resolveSupport: { properties: ['documentation','detail'] } }, contextSupport: true },
        hover:             { contentFormat: ['markdown','plaintext'] },
        signatureHelp:     { signatureInformation: { documentationFormat: ['markdown','plaintext'] } },
        definition:        { linkSupport: false },
        references:        {},
        rename:            { prepareSupport: false },
        publishDiagnostics:{ relatedInformation: true, tagSupport: { valueSet: [1,2] } },
      },
      workspace: { workspaceFolders: true },
    };
  }

  function _notifyStatusChange() {
    document.dispatchEvent(new CustomEvent('lsp:status-changed', { detail: getStatus() }));
  }

  // ── Public API ────────────────────────────────────────────────
  function getStatus() {
    return Object.entries(_servers).map(([id, s]) => ({
      id, state: s.state, name: id,
    }));
  }

  function getDiagnostics(uri) {
    return _diagStore.get(uri) || [];
  }

  function getAllDiagnostics() {
    const all = [];
    for (const [uri, diags] of _diagStore) {
      for (const d of diags) all.push({ uri, ...d });
    }
    return all;
  }

  function restartServer(serverId) {
    window.electronAPI.lspStop(serverId)
      .then(() => new Promise(r => setTimeout(r, 500)))
      .then(() => _startServer(serverId));
  }

  // ── Auto-connect Monaco editor ────────────────────────────────
  document.addEventListener('monaco-ready', () => {
    // Register providers for all LSP-backed languages
    for (const [lang, serverId] of Object.entries(LANG_SERVER)) {
      _registerProviders(lang, serverId);
    }

    // Hook into tab changes to sync documents
    document.addEventListener('tab-language-changed', (e) => {
      const tab = window.TabManager?.getActive?.();
      if (!tab?.filePath || !tab?.model) return;
      const uri = tab.model.uri.toString();
      const lang = tab.language;
      const serverId = LANG_SERVER[lang];
      if (!serverId) return;
      onDocumentOpen(uri, lang, tab.model.getValue());
    });

    // Track model content changes
    if (window.editor) {
      window.editor.onDidChangeModelContent(() => {
        const tab = window.TabManager?.getActive?.();
        if (!tab?.model) return;
        const lang = tab.language;
        if (!LANG_SERVER[lang]) return;
        onDocumentChange(
          tab.model.uri.toString(),
          tab.model.getValue(),
          tab.model.getVersionId()
        );
      });
    }

    // Initialize LSP servers
    init().catch(console.warn);
  });

  return {
    init, getStatus, getDiagnostics, getAllDiagnostics,
    restartServer, onDocumentOpen, onDocumentChange, onDocumentClose,
    LANG_SERVER,
  };
})();

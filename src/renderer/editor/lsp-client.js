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
  const _servers  = {};              // serverId → { state, capabilities }
  const _openDocs = new Map();       // uri → { version, languageId }
  // Diagnostics delegated to DiagnosticStore (loaded before lsp-client.js in index.html)

  // ── Latency metrics ───────────────────────────────────────────
  // Keeps last 200 samples per LSP method for the diagnostics panel.
  const _latency  = new Map(); // method → Float32Array ring buffer
  const _latIdx   = new Map(); // method → current write index
  const LAT_SIZE  = 200;

  function _recordLatency(method, ms) {
    if (!_latency.has(method)) {
      _latency.set(method, new Float32Array(LAT_SIZE));
      _latIdx.set(method, 0);
    }
    const buf = _latency.get(method);
    const idx = _latIdx.get(method);
    buf[idx] = ms;
    _latIdx.set(method, (idx + 1) % LAT_SIZE);
    // Emit to any listening panel
    window.NoterBus?.emit('lsp:latency', { method, ms });
  }

  function _timed(method, promiseFn) {
    const t0 = performance.now();
    return promiseFn().finally(() => {
      _recordLatency(method, Math.round(performance.now() - t0));
    });
  }

  function getLatencyStats() {
    const out = {};
    for (const [method, buf] of _latency) {
      const filled = buf.filter(v => v > 0);
      if (!filled.length) continue;
      const avg  = filled.reduce((a, b) => a + b, 0) / filled.length;
      const max  = Math.max(...filled);
      const min  = Math.min(...filled);
      const last = buf[(_latIdx.get(method) - 1 + LAT_SIZE) % LAT_SIZE];
      out[method] = { avg: Math.round(avg), min: Math.round(min), max: Math.round(max), last: Math.round(last), samples: filled.length };
    }
    return out;
  }

  // Language → server mapping
  const LANG_SERVER = {
    // TypeScript + JavaScript — both served by typescript-language-server (wraps tsserver)
    typescript:      'typescript',
    javascript:      'typescript',
    typescriptreact: 'typescript',
    javascriptreact: 'typescript',
    // Other languages
    python: 'pyright',
    c:      'clangd',
    cpp:    'clangd',
    java:   'jdtls',
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
      const { id, state } = status;
      if (_servers[id]) _servers[id].state = state;
      if (id === 'typescript' && (state === 'stopped' || state === 'error')) {
        _restoreMonacoSemantics();
      }
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

    _servers[serverId] = { state: 'starting', capabilities: _defaultCapabilities(serverId) };

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
        initializationOptions: _initOptions(serverId),
      });

      await window.electronAPI.lspNotify(serverId, 'initialized', {});
      _servers[serverId] = {
        state: 'running',
        capabilities: _deriveCapabilities(caps?.capabilities || {}),
      };
      // TypeScript server owns semantic features — Monaco web worker steps back
      if (serverId === 'typescript') _disableMonacoSemantics();
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
    // DiagnosticStore handles Monaco marker application + subscriber notification
    window.DiagnosticStore?.set(uri, diagnostics);
  }

  // ── Monaco completion provider for LSP ───────────────────────
  // Pipeline: LSP items → CompletionNormalizer.fromLsp → rankItems → toMonaco
  // resolveCompletionItem fetches full docs on demand (Milestone 2).
  function _registerCompletionProvider(languageId, serverId) {
    if (typeof monaco === 'undefined') return;
    const N = window.CompletionNormalizer;

    monaco.languages.registerCompletionItemProvider(languageId, {
      triggerCharacters: ['.', '(', ',', '<', '"', "'", '/', '@', '#', ':'],

      async provideCompletionItems(model, position, context) {
        if (!_caps(serverId).completion || _servers[serverId]?.state !== 'running') {
          return { suggestions: [] };
        }
        const uri    = model.uri.toString();
        const word   = model.getWordUntilPosition(position);
        const prefix = word.word;
        const range  = {
          startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
          startColumn: word.startColumn,        endColumn: word.endColumn,
        };

        return _timed('completion', async () => {
          try {
            const { result, error } = await window.electronAPI.lspRequest(
              serverId, 'textDocument/completion', {
                textDocument: { uri },
                position:     { line: position.lineNumber - 1, character: position.column - 1 },
                context:      { triggerKind: context.triggerKind, triggerCharacter: context.triggerCharacter },
              }
            );
            if (error || !result) return { suggestions: [] };

            const lspItems    = Array.isArray(result) ? result : (result.items ?? []);
            const noterItems  = lspItems.map(i => N.fromLsp(i, serverId));
            const ranked      = N.rankItems(noterItems, prefix);
            const suggestions = ranked.map(i => N.toMonaco(i, range));

            return { suggestions, incomplete: result.isIncomplete ?? false };
          } catch { return { suggestions: [] }; }
        });
      },

      // Milestone 2 — fetch full docs when user highlights an item
      async resolveCompletionItem(monacoItem) {
        return N.resolve(monacoItem, serverId);
      },
    });

    // Track which item the user actually accepted (for recent-use ranking)
    monaco.editor.onDidChangeModelContent?.(() => {
      // Best proxy: record when user commits a suggestion
      // Monaco fires this after insertText; label comes from the last triggered item.
      // Full tracking requires onDidAcceptSuggestion which isn't public —
      // we record in resolveCompletionItem acceptance path instead.
    });
  }

  // ── Monaco hover provider for LSP ────────────────────────────
  function _registerHoverProvider(languageId, serverId) {
    if (typeof monaco === 'undefined') return;
    monaco.languages.registerHoverProvider(languageId, {
      async provideHover(model, position) {
        if (!_caps(serverId).hover || _servers[serverId]?.state !== 'running') return null;
        const uri = model.uri.toString();
        return _timed('hover', async () => {
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
        });
      },
    });
  }

  // ── Definition provider ───────────────────────────────────────
  function _registerDefinitionProvider(languageId, serverId) {
    if (typeof monaco === 'undefined') return;
    monaco.languages.registerDefinitionProvider(languageId, {
      async provideDefinition(model, position) {
        if (!_caps(serverId).definition || _servers[serverId]?.state !== 'running') return null;
        return _timed('definition', async () => { try {
          const { result } = await window.electronAPI.lspRequest(serverId, 'textDocument/definition', {
            textDocument: { uri: model.uri.toString() },
            position:     { line: position.lineNumber - 1, character: position.column - 1 },
          });
          if (!result) return null;
          const locs = Array.isArray(result) ? result : [result];
          return locs.map(loc => ({
            uri:   _lspUri(loc.uri),
            range: _lspRangeToMonaco(loc.range),
          }));
        } catch { return null; } });
      },
    });
  }

  // ── References provider ───────────────────────────────────────
  function _registerReferencesProvider(languageId, serverId) {
    if (typeof monaco === 'undefined') return;
    monaco.languages.registerReferenceProvider(languageId, {
      async provideReferences(model, position, ctx) {
        if (!_caps(serverId).references || _servers[serverId]?.state !== 'running') return null;
        try {
          const { result } = await window.electronAPI.lspRequest(serverId, 'textDocument/references', {
            textDocument: { uri: model.uri.toString() },
            position:     { line: position.lineNumber - 1, character: position.column - 1 },
            context:      { includeDeclaration: ctx.includeDeclaration },
          });
          return (result || []).map(loc => ({
            uri:   _lspUri(loc.uri),
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
        if (!_caps(serverId).rename || _servers[serverId]?.state !== 'running') return null;
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
              edits.push({ resource: _lspUri(uri), edit: { range: _lspRangeToMonaco(edit.range), text: edit.newText } });
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

  // ── Code action provider (quick fixes, refactors) ────────────
  function _registerCodeActionProvider(languageId, serverId) {
    if (typeof monaco === 'undefined') return;
    monaco.languages.registerCodeActionProvider(languageId, {
      async provideCodeActions(model, range, context) {
        if (_servers[serverId]?.state !== 'running') return { actions: [], dispose() {} };
        try {
          const { result } = await window.electronAPI.lspRequest(serverId, 'textDocument/codeAction', {
            textDocument: { uri: model.uri.toString() },
            range: {
              start: { line: range.startLineNumber - 1, character: range.startColumn - 1 },
              end:   { line: range.endLineNumber - 1,   character: range.endColumn - 1   },
            },
            context: {
              diagnostics: context.markers.map(m => ({
                range: {
                  start: { line: m.startLineNumber - 1, character: m.startColumn - 1 },
                  end:   { line: m.endLineNumber - 1,   character: m.endColumn - 1   },
                },
                severity: _monacoSevToLsp(m.severity),
                message:  m.message,
                source:   m.source || 'lsp',
                code:     m.code?.value ?? m.code,
              })),
              only: [],
              triggerKind: 1,
            },
          });
          if (!result) return { actions: [], dispose() {} };
          const raw     = Array.isArray(result) ? result : (result.items || []);
          const actions = raw
            .filter(a => a?.title)
            .map(a => ({
              title:       a.title,
              kind:        a.kind || 'quickfix',
              diagnostics: context.markers,
              isPreferred: a.isPreferred || false,
              edit:        a.edit ? _lspWorkspaceEditToMonaco(a.edit) : undefined,
              command:     a.command ? {
                id:        'workbench.action.executeCommand',
                title:     a.command.title || a.title,
                arguments: a.command.arguments || [],
              } : undefined,
            }));
          return { actions, dispose() {} };
        } catch { return { actions: [], dispose() {} }; }
      },
    });
  }

  function _monacoSevToLsp(s) { return s >= 8 ? 1 : s >= 4 ? 2 : s >= 2 ? 3 : 4; }

  function _lspWorkspaceEditToMonaco(lspEdit) {
    const edits = [];
    for (const [uri, fileEdits] of Object.entries(lspEdit.changes || {})) {
      for (const e of fileEdits) {
        edits.push({
          resource:  _lspUri(uri),
          versionId: null,
          textEdit: {
            range: _lspRangeToMonaco(e.range),
            text:  e.newText,
          },
        });
      }
    }
    if (lspEdit.documentChanges) {
      for (const change of lspEdit.documentChanges) {
        if (change.edits) {
          const uri = change.textDocument?.uri || change.uri;
          for (const e of change.edits) {
            edits.push({
              resource:  _lspUri(uri),
              versionId: null,
              textEdit:  { range: _lspRangeToMonaco(e.range), text: e.newText },
            });
          }
        }
      }
    }
    return { edits };
  }

  // ── Inlay hints provider (parameter names, types) ─────────────
  function _registerInlayHintsProvider(languageId, serverId) {
    if (typeof monaco === 'undefined') return;
    // Monaco 0.44+ inlay hints provider
    if (!monaco.languages.registerInlayHintsProvider) return;
    monaco.languages.registerInlayHintsProvider(languageId, {
      async provideInlayHints(model, range) {
        if (_servers[serverId]?.state !== 'running') return { hints: [], dispose() {} };
        try {
          const { result } = await window.electronAPI.lspRequest(serverId, 'textDocument/inlayHint', {
            textDocument: { uri: model.uri.toString() },
            range: {
              start: { line: range.startLineNumber - 1, character: range.startColumn - 1 },
              end:   { line: range.endLineNumber - 1,   character: range.endColumn - 1   },
            },
          });
          if (!result) return { hints: [], dispose() {} };
          const hints = (Array.isArray(result) ? result : []).map(h => {
            const label = Array.isArray(h.label)
              ? h.label.map(p => (typeof p === 'string' ? p : p.value)).join('')
              : String(h.label);
            return {
              kind:     h.kind === 1
                ? monaco.languages.InlayHintKind.Type
                : monaco.languages.InlayHintKind.Parameter,
              position: { lineNumber: h.position.line + 1, column: h.position.character + 1 },
              label,
              paddingLeft:  h.paddingLeft  || false,
              paddingRight: h.paddingRight || false,
              tooltip:      h.tooltip
                ? { value: typeof h.tooltip === 'string' ? h.tooltip : h.tooltip.value }
                : undefined,
            };
          });
          return { hints, dispose() {} };
        } catch { return { hints: [], dispose() {} }; }
      },
    });
  }

  // ── Semantic tokens provider (LSP → Monaco) ───────────────────
  const _SEMANTIC_TOKEN_TYPES = [
    'namespace','type','class','enum','interface','struct','typeParameter',
    'parameter','variable','property','enumMember','event','function','method',
    'macro','keyword','modifier','comment','string','number','regexp','operator',
    'decorator',
  ];
  const _SEMANTIC_TOKEN_MODIFIERS = [
    'declaration','definition','readonly','static','deprecated','abstract',
    'async','modification','documentation','defaultLibrary',
  ];

  function _registerSemanticTokensProvider(languageId, serverId) {
    if (typeof monaco === 'undefined') return;
    if (!monaco.languages.registerDocumentSemanticTokensProvider) return;
    monaco.languages.registerDocumentSemanticTokensProvider(languageId, {
      getLegend() {
        return {
          tokenTypes:     _SEMANTIC_TOKEN_TYPES,
          tokenModifiers: _SEMANTIC_TOKEN_MODIFIERS,
        };
      },
      async provideDocumentSemanticTokens(model, _lastResultId) {
        if (_servers[serverId]?.state !== 'running') return null;
        try {
          const { result } = await window.electronAPI.lspRequest(serverId, 'textDocument/semanticTokens/full', {
            textDocument: { uri: model.uri.toString() },
          });
          if (!result?.data) return null;
          return {
            data:        new Uint32Array(result.data),
            resultId:    result.resultId,
          };
        } catch { return null; }
      },
      releaseDocumentSemanticTokens() {},
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
    _registerCodeActionProvider(languageId, serverId);
    _registerInlayHintsProvider(languageId, serverId);
    _registerSemanticTokensProvider(languageId, serverId);
  }

  // ── Helpers ───────────────────────────────────────────────────
  function _lspRangeToMonaco(r) {
    return {
      startLineNumber: r.start.line + 1, startColumn: r.start.character + 1,
      endLineNumber:   r.end.line + 1,   endColumn:   r.end.character + 1,
    };
  }

  // Convert a tsserver URI to a Monaco Uri object.
  // tsserver encodes Windows paths as file:///e%3A/path (lowercase, encoded colon).
  // monaco.Uri.file() produces the canonical format Monaco uses for model lookups.
  // Without this, "Go to Definition" across files silently creates a blank model
  // instead of navigating to the open tab — same class of bug as DiagnosticStore URI fix.
  function _lspUri(rawUri) {
    try {
      const decoded = decodeURIComponent(rawUri);
      // Strip scheme: "file:///e:/path" → "e:/path" (Windows) or "/home/..." (Unix)
      const filePath = decoded.replace(/^file:\/\/\//, '').replace(/^file:\/\//, '');
      return monaco.Uri.file(filePath);
    } catch {
      return monaco.Uri.parse(rawUri);
    }
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

  // ── Capability Matrix ─────────────────────────────────────────
  // Conservative static defaults (used from 'starting' until initialize responds).
  // Mirrors noter-core-api/src/types/capability.rs — keep in sync.
  const _SERVER_DEFAULTS = {
    typescript: { hover:true, completion:true, signatureHelp:true, diagnostics:true,
                  definition:true, references:true, rename:true, codeActions:true,
                  inlayHints:true, semanticTokens:true, formatting:true },
    pyright:    { hover:true, completion:true, signatureHelp:true, diagnostics:true,
                  definition:true, references:true, rename:true, codeActions:true,
                  inlayHints:false, semanticTokens:true, formatting:false },
    clangd:     { hover:true, completion:true, signatureHelp:true, diagnostics:true,
                  definition:true, references:true, rename:true, codeActions:true,
                  inlayHints:true, semanticTokens:false, formatting:true },
    jdtls:      { hover:true, completion:true, signatureHelp:true, diagnostics:true,
                  definition:true, references:true, rename:true, codeActions:true,
                  inlayHints:false, semanticTokens:false, formatting:true },
  };
  const _NONE_CAPS = { hover:false, completion:false, signatureHelp:false, diagnostics:false,
                        definition:false, references:false, rename:false, codeActions:false,
                        inlayHints:false, semanticTokens:false, formatting:false };

  function _defaultCapabilities(serverId) {
    return { ...(_SERVER_DEFAULTS[serverId] || _NONE_CAPS) };
  }

  function _deriveCapabilities(serverCaps) {
    const has = (key) => serverCaps[key] != null && serverCaps[key] !== false;
    return {
      hover:          has('hoverProvider'),
      completion:     has('completionProvider'),
      signatureHelp:  has('signatureHelpProvider'),
      diagnostics:    true,
      definition:     has('definitionProvider'),
      references:     has('referencesProvider'),
      rename:         has('renameProvider'),
      codeActions:    has('codeActionProvider'),
      inlayHints:     has('inlayHintProvider'),
      semanticTokens: has('semanticTokensProvider'),
      formatting:     has('documentFormattingProvider'),
    };
  }

  function _caps(serverId) {
    return _servers[serverId]?.capabilities || _NONE_CAPS;
  }

  function _initOptions(serverId) {
    if (serverId === 'typescript') {
      return {
        // tsserver preferences — enable all inlay hints for maximum value
        preferences: {
          includeInlayParameterNameHints:                   'all',
          includeInlayParameterNameHintsWhenArgumentMatchesName: false,
          includeInlayFunctionParameterTypeHints:           true,
          includeInlayVariableTypeHints:                    true,
          includeInlayPropertyDeclarationTypeHints:         true,
          includeInlayFunctionLikeReturnTypeHints:          true,
          includeInlayEnumMemberValueHints:                 true,
          importModuleSpecifierPreference:                  'shortest',
        },
        tsserver: {
          logVerbosity: 'off',
          trace:        'off',
        },
      };
    }
    if (serverId === 'pyright') return { pythonPath: null };
    return undefined;
  }

  function _clientCapabilities() {
    return {
      textDocument: {
        synchronization: {
          willSave:             false,
          didSave:              false,
          dynamicRegistration:  false,
        },
        completion: {
          completionItem: {
            snippetSupport:       true,
            commitCharactersSupport: true,
            documentationFormat:  ['markdown', 'plaintext'],
            deprecatedSupport:    true,
            preselectSupport:     true,
            tagSupport:           { valueSet: [1] },
            insertReplaceSupport: true,
            resolveSupport:       { properties: ['documentation', 'detail', 'additionalTextEdits'] },
            insertTextModeSupport:{ valueSet: [1, 2] },
            labelDetailsSupport:  true,
          },
          contextSupport: true,
          insertTextMode: 2,
          completionList: { itemDefaults: ['commitCharacters', 'editRange', 'insertTextFormat', 'insertTextMode'] },
        },
        hover: {
          contentFormat: ['markdown', 'plaintext'],
          dynamicRegistration: false,
        },
        signatureHelp: {
          signatureInformation: {
            documentationFormat:     ['markdown', 'plaintext'],
            parameterInformation:    { labelOffsetSupport: true },
            activeParameterSupport:  true,
          },
          contextSupport: true,
          dynamicRegistration: false,
        },
        declaration:          { linkSupport: false },
        definition:           { linkSupport: false },
        typeDefinition:       { linkSupport: false },
        implementation:       { linkSupport: false },
        references:           { dynamicRegistration: false },
        documentHighlight:    { dynamicRegistration: false },
        documentSymbol:       {
          symbolKind:          { valueSet: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26] },
          hierarchicalDocumentSymbolSupport: true,
          labelSupport:        true,
        },
        codeAction: {
          dynamicRegistration: false,
          codeActionLiteralSupport: {
            codeActionKind: {
              valueSet: [
                '', 'quickfix', 'refactor', 'refactor.extract', 'refactor.inline',
                'refactor.rewrite', 'source', 'source.organizeImports',
                'source.fixAll', 'source.fixAll.ts',
              ],
            },
          },
          isPreferredSupport:   true,
          disabledSupport:      true,
          dataSupport:          true,
          resolveSupport:       { properties: ['edit'] },
          honorsChangeAnnotations: false,
        },
        codeLens:             { dynamicRegistration: false },
        formatting:           { dynamicRegistration: false },
        rangeFormatting:      { dynamicRegistration: false },
        rename: {
          dynamicRegistration:  false,
          prepareSupport:       false,
          prepareSupportDefaultBehavior: 1,
          honorsChangeAnnotations: false,
        },
        publishDiagnostics: {
          relatedInformation:   true,
          tagSupport:           { valueSet: [1, 2] },
          versionSupport:       false,
          codeDescriptionSupport: true,
          dataSupport:          true,
        },
        inlayHint: {
          dynamicRegistration: false,
          resolveSupport:      { properties: ['tooltip', 'textEdits', 'label.tooltip', 'label.location', 'label.command'] },
        },
        semanticTokens: {
          dynamicRegistration: false,
          tokenTypes:          [
            'namespace','type','class','enum','interface','struct','typeParameter',
            'parameter','variable','property','enumMember','event','function','method',
            'macro','keyword','modifier','comment','string','number','regexp','operator',
            'decorator',
          ],
          tokenModifiers: [
            'declaration','definition','readonly','static','deprecated','abstract',
            'async','modification','documentation','defaultLibrary',
          ],
          formats:             ['relative'],
          requests: {
            full:  true,
            range: false,
          },
          overlappingTokenSupport:  false,
          multilineTokenSupport:    false,
          serverCancelSupport:      false,
          augmentsSyntaxTokens:     true,
        },
        foldingRange:         { dynamicRegistration: false },
        selectionRange:       { dynamicRegistration: false },
        callHierarchy:        { dynamicRegistration: false },
        typeHierarchy:        { dynamicRegistration: false },
        linkedEditingRange:   { dynamicRegistration: false },
      },
      workspace: {
        workspaceFolders:     true,
        configuration:        true,
        applyEdit:            true,
        workspaceEdit: {
          documentChanges:        true,
          resourceOperations:     ['create', 'rename', 'delete'],
          failureHandling:        'textOnlyTransactional',
          normalizesLineEndings:  true,
          changeAnnotationSupport: { groupsOnLabel: true },
        },
        symbol: {
          symbolKind: { valueSet: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26] },
          tagSupport: { valueSet: [1] },
          resolveSupport: { properties: ['location.range'] },
        },
        semanticTokens:       { refreshSupport: false },
        inlayHint:            { refreshSupport: false },
        diagnostics:          { refreshSupport: false },
        codeLens:             { refreshSupport: false },
      },
      general: {
        positionEncodings: ['utf-16'],
        markdown:          { parser: 'marked', version: '1.1.0' },
      },
    };
  }

  function _notifyStatusChange() {
    document.dispatchEvent(new CustomEvent('lsp:status-changed', { detail: getStatus() }));
  }

  // ── Monaco built-in TS ownership control ──────────────────────
  // Provider ownership rules (enforced here, matches Rust LspCapabilityMatrix docs):
  //   Hover      → Monaco built-in + LSP   (additive, more info = better)
  //   Completion → LSP ONLY               (Monaco gives duplicate suggestions)
  //   Diagnostics→ Monaco syntax + LSP semantic (different sources, no conflict)
  //   Rename     → LSP ONLY
  //   References → LSP ONLY
  //
  // When tsserver is running we disable Monaco's SEMANTIC layer (completions, semantic
  // diagnostics). Syntax highlighting + syntax errors stay active — Monaco is faster
  // for these. When tsserver stops we restore Monaco semantics as a fallback.

  function _disableMonacoSemantics() {
    if (typeof monaco === 'undefined') return;
    const tsD = monaco.languages.typescript.typescriptDefaults;
    const jsD = monaco.languages.typescript.javascriptDefaults;
    // Disable semantic validation — LSP provides richer diagnostics
    tsD.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false, noSuggestionDiagnostics: true });
    jsD.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false, noSuggestionDiagnostics: true });
    // Disable inlay hints from Monaco web worker — LSP provides them via tsserver
    tsD.setInlayHintsOptions?.({ includeInlayParameterNameHints: 'none', includeInlayFunctionLikeReturnTypeHints: false, includeInlayVariableTypeHints: false });
    jsD.setInlayHintsOptions?.({ includeInlayParameterNameHints: 'none', includeInlayFunctionLikeReturnTypeHints: false, includeInlayVariableTypeHints: false });
  }

  function _restoreMonacoSemantics() {
    if (typeof monaco === 'undefined') return;
    const tsD = monaco.languages.typescript.typescriptDefaults;
    const jsD = monaco.languages.typescript.javascriptDefaults;
    tsD.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false, noSuggestionDiagnostics: false });
    jsD.setDiagnosticsOptions({ noSemanticValidation: true,  noSyntaxValidation: false, noSuggestionDiagnostics: true });
  }

  // ── Public API ────────────────────────────────────────────────
  function getStatus() {
    return Object.entries(_servers).map(([id, s]) => ({
      id, state: s.state, name: id,
    }));
  }

  function getDiagnostics(uri) {
    return window.DiagnosticStore?.get(uri) ?? [];
  }

  function getAllDiagnostics() {
    return window.DiagnosticStore?.getAll() ?? [];
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
    getLatencyStats,
    LANG_SERVER,
  };
})();

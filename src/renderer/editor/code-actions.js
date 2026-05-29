// ─── Code Actions & Quick Fixes ──────────────────────────────────────────────
// Provides VS Code-style Ctrl+. quick fixes and lightbulb actions.
//
// For JS/TS: uses Monaco's built-in TypeScript worker for:
//   • Auto-import missing symbols (import React, useState, express, etc.)
//   • Organize imports (remove unused, sort)
//   • Infer function return types
//   • All TS compiler-known code fixes (errorCodes → fixes)
//
// For Python/C++/Java: see lsp-client.js (_registerCodeActionProvider)
//
// Commands registered:
//   editor.action.quickFix          Ctrl+.
//   editor.action.organizeImports   Shift+Alt+O
//   editor.action.autoFix           Apply all auto-fixable diagnostics
'use strict';

window.CodeActions = (() => {
  const _disposables = [];

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function _modelOffsets(model, range) {
    return {
      start: model.getOffsetAt({ lineNumber: range.startLineNumber, column: range.startColumn }),
      end:   model.getOffsetAt({ lineNumber: range.endLineNumber,   column: range.endColumn   }),
    };
  }

  function _lspRangeFromMonaco(r) {
    return {
      startLineNumber: r.start.line + 1, startColumn: r.start.character + 1,
      endLineNumber:   r.end.line + 1,   endColumn:   r.end.character + 1,
    };
  }

  function _tsEditToMonacoEdit(model, textChange) {
    const startPos = model.getPositionAt(textChange.span.start);
    const endPos   = model.getPositionAt(textChange.span.start + textChange.span.length);
    return {
      resource:  model.uri,
      versionId: model.getVersionId(),
      textEdit: {
        range: {
          startLineNumber: startPos.lineNumber, startColumn: startPos.column,
          endLineNumber:   endPos.lineNumber,   endColumn:   endPos.column,
        },
        text: textChange.newText,
      },
    };
  }

  // ── JS / TS code action provider ────────────────────────────────────────────
  function _registerTsProvider(lang) {
    const d = monaco.languages.registerCodeActionProvider(lang, {
      async provideCodeActions(model, range, context) {
        const actions = [];

        // ── 1. Code fixes from TS worker (error-driven) ──────────────────
        let worker;
        try {
          const isTs = lang === 'typescript' || lang === 'typescriptreact';
          const fn   = isTs
            ? monaco.languages.typescript.getTypeScriptWorker
            : monaco.languages.typescript.getJavaScriptWorker;
          worker = await fn().then(proxy => proxy(model.uri));
        } catch { /* worker unavailable */ }

        if (worker) {
          const fileName   = model.uri.toString();
          const { start, end } = _modelOffsets(model, range);
          const formatOpts = {
            tabSize: 2, indentSize: 2,
            convertTabsToSpaces: true, newLineCharacter: '\n',
            insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
          };
          const prefs = {
            importModuleSpecifierPreference: 'shortest',
            importModuleSpecifierEnding:     'auto',
            includeCompletionsForModuleExports: true,
            includeCompletionsWithInsertText:   true,
          };

          // ── Get error codes from diagnostic markers ────────────────────
          const errorCodes = context.markers
            .map(m => {
              const raw = m.code?.value ?? m.code;
              return typeof raw === 'number' ? raw : parseInt(String(raw), 10);
            })
            .filter(c => !isNaN(c) && c > 0);

          // ── Request fixes for each diagnostic ─────────────────────────
          try {
            const fixes = await worker.getCodeFixesAtPosition(
              fileName, start, end, errorCodes, formatOpts, prefs
            );
            for (const fix of (fixes || [])) {
              const edits = [];
              for (const change of (fix.changes || [])) {
                // Only apply edits to the current model (cross-file edits need tab opens)
                if (change.fileName === fileName || change.fileName === model.uri.path) {
                  for (const te of (change.textChanges || [])) {
                    edits.push(_tsEditToMonacoEdit(model, te));
                  }
                }
              }
              if (edits.length) {
                actions.push({
                  title:       fix.description || 'Fix',
                  kind:        fix.fixName?.startsWith('import') ? 'quickfix' : 'quickfix',
                  diagnostics: context.markers,
                  edit:        { edits },
                  isPreferred: fix.fixName === 'import' || fix.fixName === 'fixMissingMember',
                });
              }
            }
          } catch {}

          // ── Applicable refactors (non-error-driven actions) ───────────
          try {
            const refactors = await worker.getApplicableRefactors(
              fileName, { pos: start, end }, prefs, undefined, undefined, false
            );
            for (const refactor of (refactors || [])) {
              for (const action of (refactor.actions || [])) {
                if (action.notApplicableReason) continue;
                actions.push({
                  title:    `${refactor.name}: ${action.description}`,
                  kind:     'refactor',
                  command: {
                    id:        '_noter.applyRefactor',
                    title:     action.description,
                    arguments: [model.uri, refactor.name, action.name, start, end],
                  },
                });
              }
            }
          } catch {}

          // ── Organize Imports (always available for code source actions) ─
          try {
            const organized = await worker.organizeImports(
              { type: 'file', fileName }, formatOpts, prefs
            );
            const orgEdits = [];
            for (const change of (organized || [])) {
              if (change.fileName === fileName || change.fileName === model.uri.path) {
                for (const te of (change.textChanges || [])) {
                  orgEdits.push(_tsEditToMonacoEdit(model, te));
                }
              }
            }
            if (orgEdits.length) {
              actions.push({
                title:    'Organize Imports',
                kind:     'source.organizeImports',
                edit:     { edits: orgEdits },
              });
            }
          } catch {}
        }

        return { actions, dispose() {} };
      },
    });
    _disposables.push(d);
  }

  // ── Apply a TS refactor on command ──────────────────────────────────────────
  async function _applyRefactor(uri, refactorName, actionName, start, end) {
    const model = monaco.editor.getModel(uri);
    if (!model) return;

    const isTs = ['typescript', 'typescriptreact'].includes(model.getLanguageId());
    try {
      const fn     = isTs
        ? monaco.languages.typescript.getTypeScriptWorker
        : monaco.languages.typescript.getJavaScriptWorker;
      const worker = await fn().then(proxy => proxy(uri));
      const formatOpts = { tabSize: 2, indentSize: 2, convertTabsToSpaces: true, newLineCharacter: '\n' };
      const prefs      = { importModuleSpecifierPreference: 'shortest' };
      const result     = await worker.getEditsForRefactor(
        uri.toString(), formatOpts, { pos: start, end }, refactorName, actionName, prefs
      );
      if (result?.edits?.length) {
        const edits = result.edits
          .flatMap(change => (change.textChanges || []).map(te => ({
            range: {
              startLineNumber: model.getPositionAt(te.span.start).lineNumber,
              startColumn:     model.getPositionAt(te.span.start).column,
              endLineNumber:   model.getPositionAt(te.span.start + te.span.length).lineNumber,
              endColumn:       model.getPositionAt(te.span.start + te.span.length).column,
            },
            text: te.newText,
          })));
        model.pushEditOperations([], edits, () => null);
      }
    } catch (err) {
      console.warn('[CodeActions] refactor error:', err);
    }
  }

  // ── Quick-action lightbulb helpers ──────────────────────────────────────────
  function _registerCommands() {
    // Internal command to apply refactors from the action list
    window.editor?.addCommand(
      monaco.KeyCode.F1,  // placeholder — overridden by real binding
      () => {}
    );

    window.NoterCommands?.register({
      id:          'editor.action.quickFix',
      title:       'Quick Fix…',
      category:    'Editor',
      description: 'Show quick fix suggestions for the problem at the cursor (Ctrl+.)',
      aliases:     ['quick fix', 'fix', 'lightbulb', 'code action'],
      keybinding:  'Ctrl+.',
      handler() {
        window.editor?.trigger('noter', 'editor.action.quickFix', {});
      },
    });

    window.NoterCommands?.register({
      id:          'editor.action.organizeImports',
      title:       'Organize Imports',
      category:    'Editor',
      description: 'Sort and remove unused imports (Shift+Alt+O)',
      aliases:     ['organize imports', 'sort imports', 'clean imports', 'remove unused imports'],
      keybinding:  'Shift+Alt+O',
      handler() {
        window.editor?.trigger('noter', 'editor.action.organizeImports', {});
      },
    });

    window.NoterCommands?.register({
      id:          'editor.action.autoFix',
      title:       'Auto Fix All',
      category:    'Editor',
      description: 'Automatically apply all auto-fixable code actions in the file',
      aliases:     ['auto fix', 'fix all', 'autofix all'],
      handler() {
        window.editor?.trigger('noter', 'editor.action.fixAll', {});
      },
    });

    window.NoterCommands?.register({
      id:          'editor.action.refactor',
      title:       'Refactor…',
      category:    'Editor',
      description: 'Show available refactoring options (Ctrl+Shift+R)',
      aliases:     ['refactor', 'extract', 'inline', 'rename'],
      keybinding:  'Ctrl+Shift+R',
      handler() {
        window.editor?.trigger('noter', 'editor.action.refactor', {});
      },
    });

    window.NoterCommands?.register({
      id:          'editor.action.sourceAction',
      title:       'Source Action…',
      category:    'Editor',
      description: 'Show source code actions for the current file',
      aliases:     ['source action', 'file action'],
      handler() {
        window.editor?.trigger('noter', 'editor.action.sourceAction', {});
      },
    });

    window.NoterCommands?.register({
      id:          'editor.action.rename',
      title:       'Rename Symbol',
      category:    'Editor',
      description: 'Rename a symbol across all files (F2)',
      aliases:     ['rename', 'rename symbol', 'refactor rename'],
      keybinding:  'F2',
      handler() {
        window.editor?.trigger('noter', 'editor.action.rename', {});
      },
    });
  }

  // ── Init ────────────────────────────────────────────────────────────────────
  document.addEventListener('monaco-ready', () => {
    const tsLangs = ['typescript', 'typescriptreact', 'javascript', 'javascriptreact'];
    tsLangs.forEach(_registerTsProvider);

    // Register the internal refactor-apply command
    monaco.editor.registerCommand('_noter.applyRefactor', (_accessor, uri, refactorName, actionName, start, end) => {
      _applyRefactor(uri, refactorName, actionName, start, end);
    });

    _registerCommands();

    // Ctrl+. keyboard shortcut on the editor
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === '.') {
        const active = document.activeElement;
        if (active?.closest('#editor') || active?.closest('.monaco-editor')) {
          e.preventDefault();
          window.editor?.trigger('noter', 'editor.action.quickFix', {});
        }
      }
      // Shift+Alt+O — organize imports
      if (e.shiftKey && e.altKey && e.key === 'O') {
        const active = document.activeElement;
        if (active?.closest('#editor') || active?.closest('.monaco-editor')) {
          e.preventDefault();
          window.editor?.trigger('noter', 'editor.action.organizeImports', {});
        }
      }
      // F2 — rename
      if (!e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'F2') {
        const active = document.activeElement;
        if (active?.closest('.monaco-editor')) {
          e.preventDefault();
          window.editor?.trigger('noter', 'editor.action.rename', {});
        }
      }
    }, { capture: false });
  });

  return {
    applyRefactor: _applyRefactor,
    dispose() { _disposables.forEach(d => d.dispose?.()); },
  };
})();

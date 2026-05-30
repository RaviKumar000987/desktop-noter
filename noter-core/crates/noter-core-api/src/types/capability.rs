use serde::{Deserialize, Serialize};

/// Per-server capability matrix — derived from LSP initialize response.
/// UI checks this before showing any feature button or registering a Monaco provider.
/// Prevents showing a "Rename" button for a server that doesn't support rename.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspCapabilityMatrix {
    pub hover:           bool,
    pub completion:      bool,
    pub signature_help:  bool,
    pub diagnostics:     bool,   // always true — servers always push publishDiagnostics
    pub definition:      bool,
    pub references:      bool,
    pub rename:          bool,
    pub code_actions:    bool,
    pub inlay_hints:     bool,
    pub semantic_tokens: bool,
    pub formatting:      bool,
    pub folding:         bool,
}

impl LspCapabilityMatrix {
    /// All capabilities on — used for tsserver which supports everything.
    pub fn full() -> Self {
        Self {
            hover: true, completion: true, signature_help: true,
            diagnostics: true, definition: true, references: true,
            rename: true, code_actions: true, inlay_hints: true,
            semantic_tokens: true, formatting: true, folding: true,
        }
    }

    /// No capabilities — safe default before server responds.
    pub fn none() -> Self {
        Self {
            hover: false, completion: false, signature_help: false,
            diagnostics: false, definition: false, references: false,
            rename: false, code_actions: false, inlay_hints: false,
            semantic_tokens: false, formatting: false, folding: false,
        }
    }

    /// Build from the `capabilities` field of an LSP initialize response.
    /// `caps` is the `ServerCapabilities` JSON object.
    pub fn from_server_caps(caps: &serde_json::Value) -> Self {
        let has = |key: &str| !caps[key].is_null();
        Self {
            hover:           has("hoverProvider"),
            completion:      has("completionProvider"),
            signature_help:  has("signatureHelpProvider"),
            diagnostics:     true,
            definition:      has("definitionProvider"),
            references:      has("referencesProvider"),
            rename:          has("renameProvider"),
            code_actions:    has("codeActionProvider"),
            inlay_hints:     has("inlayHintProvider"),
            semantic_tokens: has("semanticTokensProvider"),
            formatting:      has("documentFormattingProvider"),
            folding:         has("foldingRangeProvider"),
        }
    }

    /// Static conservative defaults per server (used before initialize completes).
    pub fn defaults_for(server_id: &str) -> Self {
        match server_id {
            "typescript" => Self::full(),
            "pyright"    => Self {
                hover: true, completion: true, signature_help: true,
                diagnostics: true, definition: true, references: true,
                rename: true, code_actions: true,
                // pyright does not support these in all versions
                inlay_hints: false, semantic_tokens: true,
                formatting: false, folding: false,
            },
            "clangd"     => Self {
                hover: true, completion: true, signature_help: true,
                diagnostics: true, definition: true, references: true,
                rename: true, code_actions: true,
                inlay_hints: true, semantic_tokens: false,
                formatting: true, folding: true,
            },
            "jdtls"      => Self {
                hover: true, completion: true, signature_help: true,
                diagnostics: true, definition: true, references: true,
                rename: true, code_actions: true,
                inlay_hints: false, semantic_tokens: false,
                formatting: true, folding: false,
            },
            _ => Self::none(),
        }
    }
}

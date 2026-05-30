//! noter-core-api — single source of truth for all internal types.
//!
//! CONTRACT:
//!   - Every crate in the workspace imports types from here.
//!   - No crate imports types from another implementation crate (noter-indexer, etc.).
//!   - lsp-types appear ONLY in the `convert` module. Never elsewhere.
//!   - API_VERSION must be bumped when any type definition changes shape.

pub const API_VERSION: &str = "1.0";

pub mod types;
pub mod convert;
pub mod ipc;

// Flat re-exports for ergonomic use: `use noter_core_api::Symbol;`
pub use types::{
    FileRef, Position, Range, Location,
    Symbol, SymbolId, SymbolKind,
    Diagnostic, DiagnosticSeverity,
    Hover, MarkedString,
    CompletionItem, CompletionKind,
    CodeAction, TextEdit, WorkspaceEdit,
    Definition, Reference, RenameEdit,
    InlayHint, InlayHintKind,
    LspCapabilityMatrix,
};

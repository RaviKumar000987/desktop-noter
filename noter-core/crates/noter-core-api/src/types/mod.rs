pub mod location;
pub mod symbol;
pub mod diagnostic;
pub mod hover;
pub mod completion;
pub mod code_action;
pub mod capability;

pub use location::{FileRef, Position, Range, Location};
pub use symbol::{Symbol, SymbolId, SymbolKind};
pub use diagnostic::{Diagnostic, DiagnosticSeverity};
pub use hover::{Hover, MarkedString};
pub use completion::{CompletionItem, CompletionKind};
pub use code_action::{
    CodeAction, TextEdit, WorkspaceEdit,
    Definition, Reference, RenameEdit, InlayHint, InlayHintKind,
};
pub use capability::LspCapabilityMatrix;

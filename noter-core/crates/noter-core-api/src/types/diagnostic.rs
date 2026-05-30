use serde::{Deserialize, Serialize};
use crate::types::location::{FileRef, Range};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosticSeverity {
    Error,
    Warning,
    Information,
    Hint,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    pub file: FileRef,
    pub range: Range,
    pub severity: DiagnosticSeverity,
    pub message: String,
    /// Which language server emitted this ("tsserver", "pyright", "clangd", etc.)
    pub source: String,
    pub code: Option<String>,
}

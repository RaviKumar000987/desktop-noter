use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::types::location::{FileRef, Range};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextEdit {
    pub range: Range,
    pub new_text: String,
}

/// Maps file URI → list of edits to apply in that file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceEdit {
    pub changes: HashMap<String, Vec<TextEdit>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeAction {
    pub title: String,
    pub kind: Option<String>,
    pub edit: Option<WorkspaceEdit>,
    /// Diagnostics this action resolves, if any.
    pub diagnostics: Vec<crate::types::diagnostic::Diagnostic>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Definition {
    pub origin: crate::types::location::Location,
    pub target: crate::types::location::Location,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reference {
    pub location: crate::types::location::Location,
    pub is_definition: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameEdit {
    pub new_name: String,
    pub edit: WorkspaceEdit,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InlayHint {
    pub file: FileRef,
    pub position: crate::types::location::Position,
    pub label: String,
    pub kind: InlayHintKind,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum InlayHintKind {
    Type,
    Parameter,
}

use serde::{Deserialize, Serialize};
use crate::types::{Hover, CompletionItem, Diagnostic, CodeAction, Definition, Reference, RenameEdit, InlayHint};

// ── Lifecycle ─────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct StartLspRequest {
    pub server_id: String,
    pub workspace_root: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StartLspResponse {
    pub success: bool,
    pub pid: Option<u32>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StopLspRequest {
    pub server_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StopLspResponse {
    pub success: bool,
}

// ── Hover ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct HoverRequest {
    pub server_id: String,
    pub file_uri: String,
    pub line: u32,
    pub character: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HoverResponse {
    pub hover: Option<Hover>,
}

// ── Completion ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct CompletionRequest {
    pub server_id: String,
    pub file_uri: String,
    pub line: u32,
    pub character: u32,
    pub trigger_character: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CompletionResponse {
    pub items: Vec<CompletionItem>,
    pub is_incomplete: bool,
}

// ── Diagnostics ───────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct DiagnosticsEvent {
    pub file_uri: String,
    pub diagnostics: Vec<Diagnostic>,
}

// ── Code actions (Quick Fix / Ctrl+.) ────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct CodeActionRequest {
    pub server_id: String,
    pub file_uri: String,
    pub line: u32,
    pub character: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CodeActionResponse {
    pub actions: Vec<CodeAction>,
}

// ── Definition / References / Rename ─────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct DefinitionRequest {
    pub server_id: String,
    pub file_uri: String,
    pub line: u32,
    pub character: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DefinitionResponse {
    pub definition: Option<Definition>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReferencesRequest {
    pub server_id: String,
    pub file_uri: String,
    pub line: u32,
    pub character: u32,
    pub include_declaration: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReferencesResponse {
    pub references: Vec<Reference>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RenameRequest {
    pub server_id: String,
    pub file_uri: String,
    pub line: u32,
    pub character: u32,
    pub new_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RenameResponse {
    pub edits: Option<RenameEdit>,
    pub error: Option<String>,
}

// ── Inlay hints ───────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct InlayHintsRequest {
    pub server_id: String,
    pub file_uri: String,
    pub start_line: u32,
    pub end_line: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InlayHintsResponse {
    pub hints: Vec<InlayHint>,
}

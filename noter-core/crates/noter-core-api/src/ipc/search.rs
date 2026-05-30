use serde::{Deserialize, Serialize};
use crate::types::Symbol;

// ── Symbol search (Ctrl+P / Go-to-Symbol) ────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchSymbolsRequest {
    pub db_path: String,
    pub query: String,
    pub limit: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchSymbolsResponse {
    pub symbols: Vec<Symbol>,
}

// ── Workspace indexing ────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct IndexWorkspaceRequest {
    pub root: String,
    pub db_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IndexWorkspaceResponse {
    pub symbol_count: u32,
    pub error: Option<String>,
}

// ── File text search ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct TextSearchRequest {
    pub root: String,
    pub query: String,
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub use_regex: bool,
    pub include_glob: Option<String>,
    pub exclude_glob: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TextSearchMatch {
    pub file: String,
    pub line: u32,
    pub column: u32,
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TextSearchResponse {
    pub matches: Vec<TextSearchMatch>,
}

use serde::{Deserialize, Serialize};

// ── Requests ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct BuildGraphRequest { pub workspace_root: String }

#[derive(Debug, Serialize, Deserialize)]
pub struct GetFileImportsRequest { pub workspace_root: String, pub file_path: String }

#[derive(Debug, Serialize, Deserialize)]
pub struct GetFileImportersRequest { pub workspace_root: String, pub file_path: String }

#[derive(Debug, Serialize, Deserialize)]
pub struct ImpactRequest { pub workspace_root: String, pub file_path: String }

#[derive(Debug, Serialize, Deserialize)]
pub struct FindPathRequest { pub workspace_root: String, pub from_file: String, pub to_file: String }

#[derive(Debug, Serialize, Deserialize)]
pub struct QueryNodeRequest { pub workspace_root: String, pub name: String }

#[derive(Debug, Serialize, Deserialize)]
pub struct DeadCodeRequest { pub workspace_root: String }

#[derive(Debug, Serialize, Deserialize)]
pub struct CyclesRequest { pub workspace_root: String }

#[derive(Debug, Serialize, Deserialize)]
pub struct ArchViolationsRequest { pub workspace_root: String, pub pattern: String }

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateFileRequest { pub workspace_root: String, pub file_path: String }

// ── Responses ─────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GraphNodeInfo {
    pub name: String,
    pub kind: String,
    pub file: String,
    pub line: u32,
    pub is_exported: bool,
    pub language: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BuildGraphResponse {
    pub success: bool,
    pub file_count: u32,
    pub symbol_count: u32,
    pub edge_count: u32,
    pub import_edge_count: u32,
    pub duration_ms: u32,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImpactResponse {
    pub target_name: String,
    pub target_file: String,
    pub affected_files: Vec<String>,
    pub affected_symbols: Vec<String>,
    pub affected_file_count: u32,
    pub affected_symbol_count: u32,
    pub max_depth: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UnusedSymbolInfo {
    pub name: String,
    pub file: String,
    pub line: u32,
    pub kind: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CycleInfo {
    pub files: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ArchViolationInfo {
    pub description: String,
    pub from_file: String,
    pub to_file: String,
    pub rule: String,
}

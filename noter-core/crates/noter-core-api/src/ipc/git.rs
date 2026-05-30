use serde::{Deserialize, Serialize};

// ── Status ────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct GitStatusRequest {
    pub repo_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitFileStatus {
    pub path: String,
    pub status: String,       // "M", "A", "D", "R", "??" etc. (git short format)
    pub staged: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitStatusResponse {
    pub branch: String,
    pub files: Vec<GitFileStatus>,
    pub ahead: u32,
    pub behind: u32,
}

// ── Diff ──────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct GitDiffRequest {
    pub repo_path: String,
    pub file_path: Option<String>,
    pub staged: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitDiffResponse {
    pub diff: String,
}

// ── Log / Timeline ────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct GitLogRequest {
    pub repo_path: String,
    pub file_path: Option<String>,
    pub limit: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitCommit {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub timestamp: i64,     // Unix epoch seconds
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitLogResponse {
    pub commits: Vec<GitCommit>,
}

// ── Branch ────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct GitBranchesRequest {
    pub repo_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitBranchInfo {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
    pub upstream: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitBranchesResponse {
    pub branches: Vec<GitBranchInfo>,
}

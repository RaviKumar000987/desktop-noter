use serde::{Deserialize, Serialize};

// ── Requests ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct StartWatchRequest {
    pub workspace_root: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StopWatchRequest {
    pub workspace_root: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PollEventsRequest {
    pub workspace_root: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReindexFileRequest {
    pub workspace_root: String,
    pub file_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetSnapshotRequest {
    pub workspace_root: String,
}

// ── Responses ─────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct StartWatchResponse {
    pub success: bool,
    pub already_watching: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StopWatchResponse {
    pub success: bool,
}

/// Emitted for each file-system change that triggered a reindex.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileChangedEvent {
    pub path: String,
    /// "created" | "modified" | "deleted" | "renamed" | "manual"
    pub kind: String,
    pub was_changed: bool,
    pub symbols_before: u32,
    pub symbols_after: u32,
    pub duration_ms: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PollEventsResponse {
    pub events: Vec<FileChangedEvent>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetSnapshotResponse {
    pub workspace_root: String,
    pub file_count: u32,
    pub symbol_count: u32,
    pub is_watching: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InitialScanCompleteEvent {
    pub workspace_root: String,
    pub files_indexed: u32,
    pub symbols_found: u32,
    pub duration_ms: u32,
}

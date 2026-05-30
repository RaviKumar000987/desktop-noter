use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SessionInfo {
    pub workspace:     String,
    pub session_count: u32,
    pub last_file:     Option<String>,
    pub last_active:   u64,   // unix ms
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileRecord {
    pub path:          String,
    pub opens:         u32,
    pub last_opened:   u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryRecord {
    pub query: String,
    pub at:    u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct WorkspacePatterns {
    pub naming:       Option<String>,
    pub framework:    Option<String>,
    pub architecture: Option<String>,
    pub language:     Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceInsight {
    pub icon:   String,
    pub title:  String,
    pub detail: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MemoryContext {
    pub recent_files:      Vec<String>,
    pub recent_queries:    Vec<String>,
    pub naming_convention: Option<String>,
    pub framework:         Option<String>,
    pub architecture:      Option<String>,
    pub language:          Option<String>,
}

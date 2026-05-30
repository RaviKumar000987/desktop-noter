use serde::{Deserialize, Serialize};
use crate::types::location::FileRef;

// ── Service state snapshot ────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ServiceStateEntry {
    pub service_id: String,
    pub state: String,          // "starting" | "ready" | "busy" | "restarting" | "backing_off" | "stopped" | "failed"
    pub restart_count: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetServiceStatesResponse {
    pub services: Vec<ServiceStateEntry>,
}

// ── Push event from Rust → renderer (via IPC push channel) ───────────────────

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RuntimePushEvent {
    ServiceStateChanged { service_id: String, state: String, restart_count: u32 },
    IndexingProgress    { workspace: String, pct: u8 },
    IndexingComplete    { workspace: String, symbol_count: usize },
    DiagnosticsChanged  { file: FileRef, count: usize },
}

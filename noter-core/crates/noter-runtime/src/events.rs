use async_trait::async_trait;
use noter_core_api::{Diagnostic, Symbol, FileRef};
use serde::{Deserialize, Serialize};
use crate::service::{ServiceId, ServiceState};

/// All events that flow through the noter event bus.
/// Layer 1 (fast): sent via tokio::sync::broadcast — for internal crate-to-crate communication.
/// Layer 2 (flexible): delivered to EventHandler trait objects — for plugins, extensions, AI.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum NoterEvent {
    // ── File ──────────────────────────────────────────────────────────────
    FileOpened   { file: FileRef },
    FileSaved    { file: FileRef },
    FileClosed   { file: FileRef },
    FileChanged  { file: FileRef },

    // ── Symbols / Index ───────────────────────────────────────────────────
    SymbolsUpdated    { file: FileRef, symbols: Vec<Symbol> },
    IndexingStarted   { workspace: String },
    IndexingComplete  { workspace: String, symbol_count: usize },
    IndexingProgress  { workspace: String, pct: u8 },

    // ── Diagnostics ───────────────────────────────────────────────────────
    DiagnosticsChanged { file: FileRef, diagnostics: Vec<Diagnostic> },
    DiagnosticsCleared { file: FileRef },

    // ── Runtime / Services ───────────────────────────────────────────────
    ServiceStateChanged { id: ServiceId, state: ServiceState },
    ServiceCrashed      { id: ServiceId, restart_count: u32, backing_off: bool },

    // ── Cache ─────────────────────────────────────────────────────────────
    CacheUpdated { key: String },
    CacheEvicted { key: String },
}

// ── Layer 1: broadcast channel type alias ─────────────────────────────────────

pub type EventTx = tokio::sync::broadcast::Sender<NoterEvent>;
pub type EventRx = tokio::sync::broadcast::Receiver<NoterEvent>;

pub fn event_channel(capacity: usize) -> (EventTx, EventRx) {
    tokio::sync::broadcast::channel(capacity)
}

// ── Layer 2: trait for external plugin/extension subscriptions ───────────────

/// Implement this trait to receive noter events in a plugin, extension, or AI engine.
/// Handlers are called asynchronously after the internal broadcast has been delivered.
#[async_trait]
pub trait EventHandler: Send + Sync {
    async fn handle(&self, event: &NoterEvent);
}

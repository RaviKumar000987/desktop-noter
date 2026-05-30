use napi_derive::napi;
use napi::bindgen_prelude::*;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use noter_watch_engine::WatchEngine;

// ── Singleton registry — one WatchEngine per workspace root ──────────────────

static ENGINES: OnceLock<Mutex<HashMap<String, WatchEngine>>> = OnceLock::new();

fn engines() -> &'static Mutex<HashMap<String, WatchEngine>> {
    ENGINES.get_or_init(|| Mutex::new(HashMap::new()))
}

// ── JS-facing types ───────────────────────────────────────────────────────────

#[napi(object)]
pub struct JsFileChangeEvent {
    pub path: String,
    /// "created" | "modified" | "deleted" | "renamed" | "manual"
    pub kind: String,
    /// false = hash unchanged (no-op reindex), true = file actually reindexed
    pub was_changed: bool,
    pub symbols_before: u32,
    pub symbols_after: u32,
    pub duration_ms: u32,
}

#[napi(object)]
pub struct JsWatchStats {
    pub root: String,
    pub is_watching: bool,
    pub files_indexed: u32,
    pub symbols_found: u32,
}

// ── NAPI functions ────────────────────────────────────────────────────────────

/// Start watching a workspace root.
/// Performs initial_scan() in a background thread, then watches for changes.
/// Returns true if newly started, false if already watching.
#[napi]
pub fn start_workspace_watch(root: String) -> Result<bool> {
    let mut guard = engines().lock().map_err(|e| Error::from_reason(e.to_string()))?;
    if guard.contains_key(&root) { return Ok(false); }

    let engine = WatchEngine::start(root.clone())
        .map_err(|e| Error::from_reason(e.to_string()))?;

    guard.insert(root, engine);
    Ok(true)
}

/// Stop watching a workspace root. Returns true if an engine was stopped.
#[napi]
pub fn stop_workspace_watch(root: String) -> Result<bool> {
    let mut guard = engines().lock().map_err(|e| Error::from_reason(e.to_string()))?;
    if let Some(engine) = guard.remove(&root) {
        engine.stop();
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Drain all pending file-change events for a workspace.
/// Call from main.js on setInterval(100ms) to push events to renderer.
#[napi]
pub fn poll_watch_events(root: String) -> Result<Vec<JsFileChangeEvent>> {
    let guard = engines().lock().map_err(|e| Error::from_reason(e.to_string()))?;
    if let Some(engine) = guard.get(&root) {
        Ok(engine.drain_events().into_iter().map(|e| JsFileChangeEvent {
            path:           e.path,
            kind:           e.kind,
            was_changed:    e.was_changed,
            symbols_before: e.symbols_before as u32,
            symbols_after:  e.symbols_after  as u32,
            duration_ms:    e.duration_ms    as u32,
        }).collect())
    } else {
        Ok(vec![])
    }
}

/// Force-reindex a single file immediately (call when user saves in editor).
/// The result will appear in the next poll_watch_events() call.
#[napi]
pub fn request_file_reindex(root: String, path: String) -> Result<bool> {
    let guard = engines().lock().map_err(|e| Error::from_reason(e.to_string()))?;
    if let Some(engine) = guard.get(&root) {
        engine.request_reindex(path);
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Returns snapshot stats for a watched workspace, or None if not watching.
#[napi]
pub fn get_watch_stats(root: String) -> Result<Option<JsWatchStats>> {
    let guard = engines().lock().map_err(|e| Error::from_reason(e.to_string()))?;
    if let Some(engine) = guard.get(&root) {
        let (files, symbols) = engine.initial_scan_stats().unwrap_or((0, 0));
        Ok(Some(JsWatchStats {
            root: engine.root().to_string(),
            is_watching: true,
            files_indexed: files as u32,
            symbols_found: symbols as u32,
        }))
    } else {
        Ok(None)
    }
}

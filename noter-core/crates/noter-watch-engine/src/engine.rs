/// WatchEngine — the central Phase 1.75 component.
///
/// Lifecycle:
///   WatchEngine::start(root) → spawns background thread → returns handle
///   background thread:
///     1. Performs initial_scan() via IncrementalIndexer
///     2. Watches for file-system events (notify → noter-watcher)
///     3. Filters events with EventFilter
///     4. Debounces via ChangeQueue (100ms window)
///     5. Reindexes changed files (< 100ms each)
///     6. Pushes FileChangeEvent to shared events queue
///   NAPI bridge:
///     drain_events()     → poll pending events (called every 100ms by main.js)
///     request_reindex()  → force-reindex one file immediately (on editor save)
///     stop()             → clean shutdown
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use crossbeam_channel::{bounded, Receiver, RecvTimeoutError, Sender};
use tracing::{debug, error, info, warn};

use noter_index_engine::{ChangeKind, ChangeQueue, IncrementalIndexer};
use noter_watcher::{FileWatcher, WatchEventKind};

use crate::filter::EventFilter;

// ── Public event type (NAPI bridge reads these) ───────────────────────────────

#[derive(Debug, Clone)]
pub struct FileChangeEvent {
    pub path: String,
    pub kind: String,          // "modified" | "created" | "deleted" | "renamed"
    pub was_changed: bool,     // false = hash match (no-op), true = actually reindexed
    pub symbols_before: usize,
    pub symbols_after: usize,
    pub duration_ms: u64,
}

// ── Engine handle ─────────────────────────────────────────────────────────────

pub struct WatchEngine {
    root: String,
    stop_tx: Sender<()>,
    reindex_tx: Sender<String>,
    events: Arc<Mutex<VecDeque<FileChangeEvent>>>,
    initial_scan_stats: Arc<Mutex<Option<noter_index_engine::IndexStats>>>,
}

impl WatchEngine {
    pub fn start(root: String) -> anyhow::Result<Self> {
        let (stop_tx, stop_rx) = bounded::<()>(1);
        let (reindex_tx, reindex_rx) = bounded::<String>(256);

        let events: Arc<Mutex<VecDeque<FileChangeEvent>>> = Arc::new(Mutex::new(VecDeque::new()));
        let scan_stats: Arc<Mutex<Option<noter_index_engine::IndexStats>>> = Arc::new(Mutex::new(None));

        let events_clone = events.clone();
        let stats_clone = scan_stats.clone();
        let root_clone = root.clone();

        thread::spawn(move || {
            run_loop(root_clone, stop_rx, reindex_rx, events_clone, stats_clone);
        });

        info!("watch-engine: started for {root}");
        Ok(Self { root, stop_tx, reindex_tx, events, initial_scan_stats: scan_stats })
    }

    /// Cleanly shut down the background thread.
    pub fn stop(self) {
        let _ = self.stop_tx.send(());
        info!("watch-engine: stop signal sent for {}", self.root);
    }

    /// Drain all pending change events (call from main.js every 100ms).
    pub fn drain_events(&self) -> Vec<FileChangeEvent> {
        let mut q = self.events.lock().unwrap();
        q.drain(..).collect()
    }

    /// Request an immediate reindex of one file (call when user saves in editor).
    pub fn request_reindex(&self, path: String) {
        let _ = self.reindex_tx.try_send(path);
    }

    pub fn root(&self) -> &str { &self.root }

    /// Returns (files, symbols) from the initial scan, once available.
    pub fn initial_scan_stats(&self) -> Option<(usize, usize)> {
        let guard = self.initial_scan_stats.lock().unwrap();
        guard.as_ref().map(|s| (s.files_indexed, s.symbols_found))
    }
}

// ── Background loop ───────────────────────────────────────────────────────────

fn run_loop(
    root: String,
    stop_rx: Receiver<()>,
    reindex_rx: Receiver<String>,
    events: Arc<Mutex<VecDeque<FileChangeEvent>>>,
    scan_stats: Arc<Mutex<Option<noter_index_engine::IndexStats>>>,
) {
    // Set up file watcher
    let watcher = match FileWatcher::watch(&root) {
        Ok(w) => w,
        Err(e) => {
            error!("watch-engine: failed to start watcher for {root}: {e}");
            return;
        }
    };

    let filter = EventFilter::new();
    let mut queue = ChangeQueue::new();
    let mut indexer = IncrementalIndexer::new(&root);

    // ── Initial full scan ─────────────────────────────────────────────────────
    match indexer.initial_scan() {
        Ok(stats) => {
            let mut guard = scan_stats.lock().unwrap();
            *guard = Some(stats);
        }
        Err(e) => {
            warn!("watch-engine: initial_scan failed: {e}");
        }
    }

    // ── Event loop ────────────────────────────────────────────────────────────
    loop {
        // Stop signal (non-blocking)
        if stop_rx.try_recv().is_ok() { break; }

        // Immediate reindex requests from NAPI (non-blocking drain)
        while let Ok(path) = reindex_rx.try_recv() {
            if filter.should_process(&path) {
                handle_reindex(&path, &mut indexer, &events, "manual");
            }
        }

        // File-system events — wait up to 50ms (debounce tick)
        match watcher.receiver.recv_timeout(Duration::from_millis(50)) {
            Ok(event) => {
                let kind = to_change_kind(event.kind);
                if filter.should_process(&event.path) {
                    debug!("watch-engine: queued {:?} {}", kind, event.path);
                    queue.push(event.path, kind);
                }
            }
            Err(RecvTimeoutError::Timeout) => {
                // Drain events whose 100ms debounce window has elapsed
                for change in queue.drain_ready() {
                    process_queued_change(&change, &mut indexer, &events);
                }
            }
            Err(RecvTimeoutError::Disconnected) => {
                info!("watch-engine: watcher channel disconnected — exiting loop");
                break;
            }
        }
    }

    info!("watch-engine: loop exited for {root}");
}

// ── Change processing ─────────────────────────────────────────────────────────

fn process_queued_change(
    change: &noter_index_engine::FileChange,
    indexer: &mut IncrementalIndexer,
    events: &Arc<Mutex<VecDeque<FileChangeEvent>>>,
) {
    let kind_str = match &change.kind {
        ChangeKind::Created          => "created",
        ChangeKind::Modified         => "modified",
        ChangeKind::Deleted          => "deleted",
        ChangeKind::Renamed { .. }   => "renamed",
    };

    match &change.kind {
        ChangeKind::Deleted => {
            let syms = indexer.handle_deleted(&change.path);
            push_event(events, FileChangeEvent {
                path: change.path.clone(),
                kind: kind_str.to_string(),
                was_changed: syms > 0,
                symbols_before: syms,
                symbols_after: 0,
                duration_ms: 0,
            });
        }
        ChangeKind::Renamed { from } => {
            // Old path removed, new path indexed
            let _ = indexer.handle_deleted(from);
            handle_reindex(&change.path, indexer, events, "renamed");
        }
        ChangeKind::Created | ChangeKind::Modified => {
            handle_reindex(&change.path, indexer, events, kind_str);
        }
    }
}

fn handle_reindex(
    path: &str,
    indexer: &mut IncrementalIndexer,
    events: &Arc<Mutex<VecDeque<FileChangeEvent>>>,
    kind: &str,
) {
    match indexer.reindex_file(path) {
        Ok(result) => {
            // Only push event if content actually changed (skip hash-match no-ops)
            if result.was_changed {
                push_event(events, FileChangeEvent {
                    path: result.path,
                    kind: kind.to_string(),
                    was_changed: true,
                    symbols_before: result.symbols_before,
                    symbols_after: result.symbols_after,
                    duration_ms: result.duration_ms,
                });
            }
        }
        Err(e) => warn!("watch-engine: reindex_file {path} failed: {e}"),
    }
}

fn push_event(events: &Arc<Mutex<VecDeque<FileChangeEvent>>>, ev: FileChangeEvent) {
    if let Ok(mut q) = events.lock() {
        // Cap queue at 500 to prevent unbounded growth if main.js is slow
        if q.len() < 500 { q.push_back(ev); }
    }
}

fn to_change_kind(kind: WatchEventKind) -> ChangeKind {
    match kind {
        WatchEventKind::Created           => ChangeKind::Created,
        WatchEventKind::Modified          => ChangeKind::Modified,
        WatchEventKind::Deleted           => ChangeKind::Deleted,
        WatchEventKind::Renamed { from }  => ChangeKind::Renamed { from },
    }
}

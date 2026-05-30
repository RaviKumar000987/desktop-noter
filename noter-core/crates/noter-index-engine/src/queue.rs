/// ChangeQueue — debounces file-system events before dispatching to the indexer.
/// Rule: same-path events within DEBOUNCE_MS are merged (latest wins).
/// This prevents thrashing during rapid saves (e.g., Prettier auto-format).
use std::collections::HashMap;
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};

const DEBOUNCE_MS: u64 = 100;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChangeKind {
    Created,
    Modified,
    Deleted,
    Renamed { from: String },
}

#[derive(Debug, Clone)]
pub struct FileChange {
    pub path: String,
    pub kind: ChangeKind,
    pub queued_at: Instant,
}

pub struct ChangeQueue {
    /// path → latest change (older events for the same path are dropped)
    pending: HashMap<String, FileChange>,
    debounce: Duration,
}

impl ChangeQueue {
    pub fn new() -> Self {
        Self {
            pending: HashMap::new(),
            debounce: Duration::from_millis(DEBOUNCE_MS),
        }
    }

    /// Push a new change. If the same path is already pending, restart its timer.
    pub fn push(&mut self, path: String, kind: ChangeKind) {
        self.pending.insert(path.clone(), FileChange { path, kind, queued_at: Instant::now() });
    }

    /// Drain all entries whose debounce window has elapsed.
    /// Returns up to `max` changes, leaving the rest in the queue.
    pub fn drain_ready(&mut self) -> Vec<FileChange> {
        let now = Instant::now();
        let mut ready = Vec::new();

        self.pending.retain(|_, change| {
            if now.duration_since(change.queued_at) >= self.debounce {
                ready.push(change.clone());
                false
            } else {
                true
            }
        });

        ready
    }

    pub fn len(&self) -> usize { self.pending.len() }
    pub fn is_empty(&self) -> bool { self.pending.is_empty() }
}

impl Default for ChangeQueue {
    fn default() -> Self { Self::new() }
}

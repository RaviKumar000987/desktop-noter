//! noter-index-engine — Phase 1.75 Incremental Workspace Index
//!
//! Key types:
//!   WorkspaceSnapshot   — per-file content hashes, symbol counts
//!   ChangeQueue         — debounces events (100ms window, dedup by path)
//!   IncrementalIndexer  — coordinates snapshot + indexer; < 100ms per file

pub mod snapshot;
pub mod queue;
pub mod incremental;

pub use snapshot::WorkspaceSnapshot;
pub use queue::{ChangeQueue, ChangeKind, FileChange};
pub use incremental::{IncrementalIndexer, IndexStats, FileIndexResult, collect_indexable_files};

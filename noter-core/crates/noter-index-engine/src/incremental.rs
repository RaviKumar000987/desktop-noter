/// IncrementalIndexer — coordinates WorkspaceSnapshot with WorkspaceIndexer.
///
/// Design:
///   initial_scan()   → hash all files, build snapshot, index changed files
///   reindex_file()   → hash one file, skip if unchanged, index if changed
///   handle_deleted() → remove from snapshot, return removed symbol count
///
/// Performance target: reindex_file() < 100ms for files up to 64KB.
use std::path::Path;
use std::time::Instant;
use anyhow::Result;
use tracing::{info, debug, warn};
use walkdir::WalkDir;

use noter_indexer::WorkspaceIndexer;
use crate::snapshot::WorkspaceSnapshot;

// ── Public result types ───────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct IndexStats {
    pub files_scanned: usize,
    pub files_indexed: usize,
    pub files_skipped: usize,   // unchanged (hash match)
    pub files_failed: usize,    // read error / parse error
    pub symbols_found: usize,
    pub duration_ms: u64,
}

#[derive(Debug, Clone)]
pub struct FileIndexResult {
    pub path: String,
    pub was_changed: bool,
    pub symbols_before: usize,
    pub symbols_after: usize,
    pub duration_ms: u64,
}

// ── Engine ────────────────────────────────────────────────────────────────────

pub struct IncrementalIndexer {
    pub snapshot: WorkspaceSnapshot,
    indexer: WorkspaceIndexer,
}

impl IncrementalIndexer {
    pub fn new(root: &str) -> Self {
        Self {
            snapshot: WorkspaceSnapshot::new(root),
            indexer: WorkspaceIndexer::new(),
        }
    }

    /// Full workspace scan — hashes every file, indexes those that changed.
    /// On first run all files are "changed" (not in snapshot yet).
    pub fn initial_scan(&mut self) -> Result<IndexStats> {
        let start = Instant::now();
        let root = self.snapshot.root.clone();
        let files = collect_indexable_files(&root);
        let total = files.len();

        let mut indexed = 0;
        let mut skipped = 0;
        let mut failed = 0;
        let mut total_symbols = 0;

        info!("incremental-indexer: initial_scan — {} files in {}", total, root);

        for path in &files {
            let path_str = path.to_string_lossy().to_string();

            match WorkspaceSnapshot::hash_file(path) {
                None => { failed += 1; continue; }
                Some((hash, size)) => {
                    if self.snapshot.needs_reindex(&path_str, hash) {
                        let syms = self.index_one(path, &root).unwrap_or(0);
                        total_symbols += syms;
                        self.snapshot.update(path_str, hash, size, syms);
                        indexed += 1;
                    } else {
                        // Already in snapshot with same hash (shouldn't happen on first run,
                        // but handles snapshot persistence across restarts in Phase 2+).
                        total_symbols += self.snapshot.get(&path_str)
                            .map(|s| s.symbol_count).unwrap_or(0);
                        skipped += 1;
                    }
                }
            }
        }

        let duration_ms = start.elapsed().as_millis() as u64;
        info!(
            "incremental-indexer: initial_scan done — {indexed}/{total} indexed, \
             {skipped} skipped, {failed} failed, {total_symbols} symbols, {duration_ms}ms"
        );

        Ok(IndexStats {
            files_scanned: total,
            files_indexed: indexed,
            files_skipped: skipped,
            files_failed: failed,
            symbols_found: total_symbols,
            duration_ms,
        })
    }

    /// Reindex a single file. Returns immediately if file hash is unchanged.
    /// Performance target: < 100ms.
    pub fn reindex_file(&mut self, path_str: &str) -> Result<FileIndexResult> {
        let start = Instant::now();
        let root = self.snapshot.root.clone();
        let path = Path::new(path_str);

        let symbols_before = self.snapshot.get(path_str).map(|s| s.symbol_count).unwrap_or(0);

        // Hash current content
        let (hash, size) = match WorkspaceSnapshot::hash_file(path) {
            None => {
                // File gone / unreadable — treat as deleted
                self.snapshot.remove(path_str);
                return Ok(FileIndexResult {
                    path: path_str.to_string(),
                    was_changed: symbols_before > 0,
                    symbols_before,
                    symbols_after: 0,
                    duration_ms: start.elapsed().as_millis() as u64,
                });
            }
            Some(h) => h,
        };

        // Check if content actually changed — O(1) comparison
        if !self.snapshot.needs_reindex(path_str, hash) {
            debug!("reindex_file: {path_str} — hash unchanged, skip");
            return Ok(FileIndexResult {
                path: path_str.to_string(),
                was_changed: false,
                symbols_before,
                symbols_after: symbols_before,
                duration_ms: start.elapsed().as_millis() as u64,
            });
        }

        // Content changed — parse + extract symbols
        let symbols_after = self.index_one(path, &root)?;
        self.snapshot.update(path_str.to_string(), hash, size, symbols_after);

        let duration_ms = start.elapsed().as_millis() as u64;

        if duration_ms > 100 {
            warn!("reindex_file: {path_str} exceeded 100ms target ({duration_ms}ms)");
        } else {
            debug!("reindex_file: {path_str} — {symbols_before}→{symbols_after} symbols in {duration_ms}ms");
        }

        Ok(FileIndexResult {
            path: path_str.to_string(),
            was_changed: true,
            symbols_before,
            symbols_after,
            duration_ms,
        })
    }

    /// Remove a deleted file from the snapshot.
    pub fn handle_deleted(&mut self, path: &str) -> usize {
        let syms = self.snapshot.remove(path).map(|s| s.symbol_count).unwrap_or(0);
        debug!("handle_deleted: {path} — {syms} symbols removed from snapshot");
        syms
    }

    /// (file_count, total_symbols)
    pub fn snapshot_stats(&self) -> (usize, usize) {
        (self.snapshot.file_count(), self.snapshot.total_symbols())
    }

    pub fn root(&self) -> &str { &self.snapshot.root }

    fn index_one(&self, path: &Path, root: &str) -> Result<usize> {
        let symbols = self.indexer.index_single_file(path, root)?;
        Ok(symbols.len())
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SKIP_DIRS: &[&str] = &[
    "node_modules", ".git", "target", "dist", "build",
    ".next", "__pycache__", "vendor", ".cache", "coverage",
    ".turbo", ".vercel", ".svelte-kit", ".parcel-cache",
];

pub fn collect_indexable_files(root: &str) -> Vec<std::path::PathBuf> {
    WalkDir::new(root)
        .max_depth(10)
        .into_iter()
        .flatten()
        .filter(|e| e.file_type().is_file())
        .filter(|e| {
            let rel = e.path().to_string_lossy().replace('\\', "/").to_lowercase();
            !SKIP_DIRS.iter().any(|d| rel.contains(&format!("/{}/", d)) || rel.starts_with(&format!("{}/", d)))
        })
        .filter(|e| {
            let ext = e.path().extension().and_then(|x| x.to_str()).unwrap_or("");
            noter_indexer::is_indexable_ext(ext)
        })
        .map(|e| e.path().to_owned())
        .collect()
}

/// WorkspaceSnapshot — tracks per-file content hashes for change detection.
/// Hash comparison is O(1) — avoids re-parsing files that haven't changed.
use std::collections::HashMap;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSnapshot {
    pub content_hash: u64,
    pub size_bytes: u64,
    pub symbol_count: usize,
    pub indexed_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceSnapshot {
    pub root: String,
    files: HashMap<String, FileSnapshot>,
}

impl WorkspaceSnapshot {
    pub fn new(root: &str) -> Self {
        Self { root: root.to_string(), files: HashMap::new() }
    }

    /// Hash file contents using DefaultHasher (fast, non-cryptographic).
    /// Returns (hash, size_bytes) or None if the file can't be read.
    pub fn hash_file(path: &Path) -> Option<(u64, u64)> {
        let content = fs::read(path).ok()?;
        let size = content.len() as u64;
        let mut h = DefaultHasher::new();
        content.hash(&mut h);
        Some((h.finish(), size))
    }

    /// Returns true if this file needs to be re-indexed (unknown or hash changed).
    pub fn needs_reindex(&self, path: &str, current_hash: u64) -> bool {
        match self.files.get(path) {
            None => true,
            Some(e) => e.content_hash != current_hash,
        }
    }

    pub fn update(&mut self, path: String, hash: u64, size: u64, symbol_count: usize) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        self.files.insert(path, FileSnapshot { content_hash: hash, size_bytes: size, symbol_count, indexed_at_ms: now });
    }

    pub fn remove(&mut self, path: &str) -> Option<FileSnapshot> {
        self.files.remove(path)
    }

    pub fn get(&self, path: &str) -> Option<&FileSnapshot> {
        self.files.get(path)
    }

    pub fn file_count(&self) -> usize { self.files.len() }

    pub fn total_symbols(&self) -> usize {
        self.files.values().map(|f| f.symbol_count).sum()
    }

    pub fn total_size_bytes(&self) -> u64 {
        self.files.values().map(|f| f.size_bytes).sum()
    }

    /// Iter all tracked paths (for debugging / smoke tests)
    pub fn paths(&self) -> impl Iterator<Item = &str> {
        self.files.keys().map(|s| s.as_str())
    }
}

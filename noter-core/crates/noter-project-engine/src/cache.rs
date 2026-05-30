use std::collections::HashMap;
use std::fs;
use std::hash::{Hash, Hasher};
use std::collections::hash_map::DefaultHasher;
use std::path::Path;
use std::time::{Duration, SystemTime};
use crate::models::ProjectInfo;

const CACHE_TTL: Duration = Duration::from_secs(3600); // 1 hour

pub struct ProjectCache {
    entries: HashMap<String, CacheEntry>,
}

struct CacheEntry {
    manifest_hash: u64,
    info: ProjectInfo,
    cached_at: SystemTime,
}

impl ProjectCache {
    pub fn new() -> Self {
        Self { entries: HashMap::new() }
    }

    pub fn get(&self, root: &str, current_hash: u64) -> Option<&ProjectInfo> {
        let e = self.entries.get(root)?;
        let age = SystemTime::now().duration_since(e.cached_at).unwrap_or(CACHE_TTL);
        if age >= CACHE_TTL { return None; }
        if e.manifest_hash != current_hash { return None; }
        Some(&e.info)
    }

    pub fn insert(&mut self, root: String, manifest_hash: u64, info: ProjectInfo) {
        self.entries.insert(root, CacheEntry { manifest_hash, info, cached_at: SystemTime::now() });
    }

    pub fn invalidate(&mut self, root: &str) {
        self.entries.remove(root);
    }
}

/// Hash all known manifest files so we can detect when dependencies change.
pub fn hash_manifests(root: &Path) -> u64 {
    const MANIFESTS: &[&str] = &[
        "package.json", "Cargo.toml", "requirements.txt", "pyproject.toml",
        "go.mod", "pom.xml", "build.gradle", "build.gradle.kts", "composer.json",
    ];
    let mut hasher = DefaultHasher::new();
    for name in MANIFESTS {
        let path = root.join(name);
        if let Ok(content) = fs::read_to_string(&path) {
            content.hash(&mut hasher);
        }
    }
    hasher.finish()
}

/// Context cache — avoids re-running retrieval+ranking for identical queries.
/// Key: query string hash. TTL: 5 minutes.
use std::collections::HashMap;
use std::time::{Duration, SystemTime};
use crate::models::AiContext;

const CACHE_TTL: Duration = Duration::from_secs(300); // 5 minutes

pub struct ContextCache {
    entries: HashMap<u64, CacheEntry>,
}

struct CacheEntry {
    ctx:       AiContext,
    cached_at: SystemTime,
}

impl ContextCache {
    pub fn new() -> Self {
        Self { entries: HashMap::new() }
    }

    pub fn get(&self, query: &str) -> Option<&AiContext> {
        let key = hash_query(query);
        let entry = self.entries.get(&key)?;
        let age = SystemTime::now()
            .duration_since(entry.cached_at)
            .unwrap_or(CACHE_TTL);
        if age >= CACHE_TTL { return None; }
        Some(&entry.ctx)
    }

    pub fn insert(&mut self, query: &str, ctx: AiContext) {
        self.entries.insert(hash_query(query), CacheEntry { ctx, cached_at: SystemTime::now() });
    }

    pub fn invalidate_all(&mut self) {
        self.entries.clear();
    }
}

impl Default for ContextCache {
    fn default() -> Self { Self::new() }
}

fn hash_query(q: &str) -> u64 {
    use std::hash::{Hash, Hasher};
    use std::collections::hash_map::DefaultHasher;
    let mut h = DefaultHasher::new();
    q.to_lowercase().trim().hash(&mut h);
    h.finish()
}

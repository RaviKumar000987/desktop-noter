use napi_derive::napi;
use napi::bindgen_prelude::*;
use noter_cache::PersistentCache;

/// Write a JSON string to the persistent cache.
#[napi]
pub fn cache_set(db_path: String, namespace: String, key: String, value: String) -> Result<()> {
    let cache = PersistentCache::open(&db_path)
        .map_err(|e| Error::from_reason(e.to_string()))?;
    let v: serde_json::Value = serde_json::from_str(&value)
        .map_err(|e| Error::from_reason(e.to_string()))?;
    cache.set(&namespace, &key, &v)
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(())
}

/// Read a JSON string from the persistent cache.
#[napi]
pub fn cache_get(db_path: String, namespace: String, key: String) -> Result<Option<String>> {
    let cache = PersistentCache::open(&db_path)
        .map_err(|e| Error::from_reason(e.to_string()))?;
    let v: Option<serde_json::Value> = cache.get(&namespace, &key)
        .map_err(|e| Error::from_reason(e.to_string()))?;
    Ok(v.map(|val| val.to_string()))
}

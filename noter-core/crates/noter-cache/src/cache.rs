use sled::Db;
use serde::{Serialize, de::DeserializeOwned};
use anyhow::Result;
use tracing::debug;

pub struct PersistentCache {
    db: Db,
}

impl PersistentCache {
    pub fn open(path: &str) -> Result<Self> {
        let db = sled::open(path)?;
        debug!("Cache opened at {path}");
        Ok(Self { db })
    }

    pub fn set<T: Serialize>(&self, namespace: &str, key: &str, value: &T) -> Result<()> {
        let k = format!("{namespace}/{key}");
        let v = serde_json::to_vec(value)?;
        self.db.insert(k.as_bytes(), v)?;
        Ok(())
    }

    pub fn get<T: DeserializeOwned>(&self, namespace: &str, key: &str) -> Result<Option<T>> {
        let k = format!("{namespace}/{key}");
        match self.db.get(k.as_bytes())? {
            Some(bytes) => Ok(Some(serde_json::from_slice(&bytes)?)),
            None => Ok(None),
        }
    }

    pub fn remove(&self, namespace: &str, key: &str) -> Result<()> {
        let k = format!("{namespace}/{key}");
        self.db.remove(k.as_bytes())?;
        Ok(())
    }

    pub fn flush(&self) -> Result<()> {
        self.db.flush()?;
        Ok(())
    }
}

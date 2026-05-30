use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

/// All known noter engine identifiers. Add new engines here first.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ServiceId {
    Lsp,
    Git,
    Search,
    Indexer,
    Ai,
    Debugger,
    Ssh,
    Containers,
    Extensions,
    Watcher,
    Cache,
}

impl std::fmt::Display for ServiceId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

/// Full lifecycle state for a service. UI reflects these states directly in the status bar.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ServiceState {
    /// Engine process is spawning / loading.
    Starting,
    /// Engine is healthy and responding.
    Ready,
    /// Engine is processing a heavy request; still alive.
    Busy,
    /// Engine crashed; runtime is restarting it.
    Restarting,
    /// Circuit breaker open: too many crashes, backing off.
    BackingOff,
    /// Engine was cleanly shut down.
    Stopped,
    /// Engine has failed permanently (exhausted restart budget).
    Failed,
}

/// Thread-safe registry of all service states. UI subscribes to change events.
#[derive(Clone)]
pub struct ServiceRegistry {
    states: Arc<RwLock<HashMap<ServiceId, ServiceState>>>,
}

impl ServiceRegistry {
    pub fn new() -> Self {
        Self { states: Arc::new(RwLock::new(HashMap::new())) }
    }

    pub fn set(&self, id: ServiceId, state: ServiceState) {
        self.states.write().unwrap().insert(id, state);
    }

    pub fn get(&self, id: ServiceId) -> Option<ServiceState> {
        self.states.read().unwrap().get(&id).copied()
    }

    pub fn all(&self) -> HashMap<ServiceId, ServiceState> {
        self.states.read().unwrap().clone()
    }
}

impl Default for ServiceRegistry {
    fn default() -> Self { Self::new() }
}

//! noter-runtime — Supervisor kernel for all noter engines.
//!
//! Responsibilities:
//!   ServiceRegistry  — tracks Running/Starting/Failed state of every engine
//!   Event Bus        — Layer 1 (broadcast) + Layer 2 (EventHandler trait)
//!   Circuit Breaker  — prevents infinite restart loops on crashing servers
//!   BootCoordinator  — deterministic startup ordering
//!
//! USAGE PATTERN:
//!   1. Build a NoterRuntime with all services registered.
//!   2. Call runtime.boot().await — services start in declared order.
//!   3. Each engine holds an EventTx clone to publish events.
//!   4. Electron IPC listens on a dedicated EventRx to push state to UI.

pub mod service;
pub mod events;
pub mod circuit_breaker;
pub mod boot;

use std::sync::Arc;
use tokio::sync::Mutex;
use crate::events::{event_channel};

const EVENT_BUS_CAPACITY: usize = 1024;

/// The central runtime object. Create one per noter process.
pub struct NoterRuntime {
    pub registry: ServiceRegistry,
    pub event_tx: EventTx,
    handlers: Arc<Mutex<Vec<Arc<dyn EventHandler>>>>,
}

impl NoterRuntime {
    pub fn new() -> Self {
        let (event_tx, _) = event_channel(EVENT_BUS_CAPACITY);
        Self {
            registry: service::ServiceRegistry::new(),
            event_tx,
            handlers: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// Subscribe an external plugin/extension to all events (Layer 2).
    pub async fn subscribe(&self, handler: Arc<dyn EventHandler>) {
        self.handlers.lock().await.push(handler);
    }

    /// Get a new Layer 1 receiver. Each engine/IPC bridge calls this once.
    pub fn subscribe_broadcast(&self) -> EventRx {
        self.event_tx.subscribe()
    }

    /// Publish an event to Layer 1 (broadcast) and Layer 2 (handlers) simultaneously.
    pub async fn emit(&self, event: NoterEvent) {
        // Layer 1: fast broadcast (ignore RecvError — no active receivers is fine)
        let _ = self.event_tx.send(event.clone());

        // Layer 2: deliver to all registered external handlers
        let handlers = self.handlers.lock().await;
        for handler in handlers.iter() {
            handler.handle(&event).await;
        }
    }
}

impl Default for NoterRuntime {
    fn default() -> Self { Self::new() }
}

// Public re-exports for crates that depend on noter-runtime
pub use service::{ServiceId, ServiceState, ServiceRegistry};
pub use events::{NoterEvent, EventTx, EventRx, EventHandler};
pub use circuit_breaker::{CircuitBreaker, CircuitDecision};
pub use boot::{BootCoordinator, BootStep};

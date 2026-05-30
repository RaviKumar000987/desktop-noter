//! noter-watch-engine — Phase 1.75 Workspace Watch Engine
//!
//! Entry point: `WatchEngine::start(root)` → runs initial_scan() then watches
//! for changes. NAPI bridge polls `drain_events()` every 100ms.

pub mod filter;
pub mod engine;

pub use engine::{WatchEngine, FileChangeEvent};

//! noter-memory-engine — Phase 2.5
//!
//! SQLite-backed workspace memory: session tracking, file history,
//! AI query history, naming convention detection, insights.
//!
//! Replaces localStorage-based workspace-memory.js with Rust persistence.
//! Entry point: `MemoryService::open(db_path)`

pub mod models;
pub mod naming;
pub mod service;

pub use models::*;
pub use service::MemoryService;

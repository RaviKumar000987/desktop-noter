//! noter-symbol-intelligence — Phase 2.1 Symbol Intelligence Engine
//!
//! Upgrades file-level Code Graph to function-level call graph:
//!   login() → authenticate() → hashPassword() → db.findUser()
//!
//! Architecture:
//!   RAM graph (petgraph)  → all queries, sub-ms latency
//!   SQLite call_edges     → persistence only (startup hydration + write-back)
//!
//! Language support order: TypeScript → JavaScript → Rust → Python → Go

pub mod models;
pub mod call_graph;
pub mod query;
pub mod flow;
pub mod cache;
pub mod db;
pub mod service;

pub use models::*;
pub use service::SymbolIntelligenceService;

//! noter-code-graph — Phase 2 Code Graph Engine
//!
//! 9-layer project brain:
//!   Layer 1: Symbol Registry   (models.rs)
//!   Layer 2: Graph Builder     (builder/ — petgraph StableDiGraph)
//!   Layer 3: Cross-file Resolver (resolver/)
//!   Layer 4: Dependency Graph  (embedded in builder)
//!   Layer 5: Query Engine      (query/)
//!   Layer 6: Impact Analysis   (query::QueryEngine::analyze_impact)
//!   Layer 7: Dead Code         (query::QueryEngine::find_unused_exports)
//!   Layer 8: Cycle Detection   (query::QueryEngine::find_cycles)
//!   Layer 9: Arch Violations   (analysis/)
//!
//! Entry point: `CodeGraphService::new(root).build()`

pub mod models;
pub mod symbols;
pub mod graph;
pub mod builder;
pub mod resolver;
pub mod query;
pub mod analysis;
pub mod service;

pub use models::*;
pub use service::CodeGraphService;
pub use graph::CodeGraphData;

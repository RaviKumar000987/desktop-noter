//! noter-reasoning-engine — Phase 2.3
//!
//! Pure-Rust project reasoning layer.
//! Risk scoring · Health computation · Debt detection · Recommendations
//!
//! Entry point: `ReasoningService::new(root).analyze()`

pub mod models;
pub mod risk;
pub mod health;
pub mod service;

pub use models::*;
pub use service::ReasoningService;

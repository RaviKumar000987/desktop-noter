#![deny(clippy::all)]

mod search;
mod git;
mod symbols;
mod cache;
mod project;
mod watch;
mod graph;
mod symbols_intel;
mod ai_context;

// Re-export all #[napi] functions — napi-derive picks them up automatically
pub use search::*;
pub use git::*;
pub use symbols::*;
pub use cache::*;
pub use project::*;
pub use watch::*;
pub use graph::*;
pub use symbols_intel::*;
pub use ai_context::*;

#![deny(clippy::all)]

mod search;
mod git;
mod symbols;
mod cache;

// Re-export all #[napi] functions — napi-derive picks them up automatically
pub use search::*;
pub use git::*;
pub use symbols::*;
pub use cache::*;

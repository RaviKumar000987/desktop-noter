pub mod indexer;
pub mod languages;

pub use indexer::WorkspaceIndexer;

// Re-export canonical types so callers don't need to depend on noter-core-api directly.
pub use noter_core_api::{Symbol, SymbolKind, FileRef, Range, Position};

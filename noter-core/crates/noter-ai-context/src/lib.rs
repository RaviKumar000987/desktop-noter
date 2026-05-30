//! noter-ai-context — Phase 2.2 AI Context Engine
//!
//! Transforms a natural language query + workspace state into a structured,
//! ranked context that AI can use to give workspace-aware answers.
//!
//! Pipeline:
//!   Query → [Retrieve] → [Rank] → [ContextBuilder] → [PromptBuilder]
//!           ↑ SymbolDB    ↑ scorer.rs  ↑ file snippets  ↑ Claude format
//!
//! All compute happens in Rust. The actual HTTP call to Claude API
//! happens in JavaScript (main.js) — following the golden rule: Rust=compute, JS=I/O.

pub mod models;
pub mod retriever;
pub mod ranker;
pub mod context_builder;
pub mod prompt_builder;
pub mod cache;
pub mod service;

pub use models::*;
pub use service::AiContextService;

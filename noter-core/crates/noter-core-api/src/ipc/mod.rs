//! Typed contracts for every IPC call that crosses the Rust ↔ Electron boundary.
//!
//! Rule: Every invoke/send/on channel MUST have a corresponding Request/Response
//! or Event type defined here. Raw `invoke("channel", untypedArg)` is banned.
//!
//! TypeScript consumers should mirror these types in src/shared/ipc-types.ts
//! (manually for now; ts-rs codegen planned for Phase 1).

pub mod lsp;
pub mod search;
pub mod git;
pub mod runtime;

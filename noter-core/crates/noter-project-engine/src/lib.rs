//! noter-project-engine — Phase 1.5 Project Intelligence Engine
//!
//! On workspace open, automatically detects:
//!   Language · Framework · Database · ORM · Auth · Build system · Architecture
//!
//! Entry point: `ProjectEngineService::scan(root_path)`

pub mod models;
pub mod manifest;
pub mod detectors;
pub mod graph;
pub mod project_map;
pub mod cache;
pub mod service;

pub use models::*;
pub use service::ProjectEngineService;

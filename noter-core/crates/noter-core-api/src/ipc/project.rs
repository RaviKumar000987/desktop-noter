use serde::{Deserialize, Serialize};

// ── Requests ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanWorkspaceRequest {
    pub workspace_root: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetProjectMapRequest {
    pub workspace_root: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetDependenciesRequest {
    pub workspace_root: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetArchitectureRequest {
    pub workspace_root: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InvalidateCacheRequest {
    pub workspace_root: String,
}

// ── Responses ─────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanWorkspaceResponse {
    pub success: bool,
    pub scan_duration_ms: u64,
    pub language_count: usize,
    pub framework_count: usize,
    pub dependency_count: usize,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetProjectMapResponse {
    pub modules: Vec<ProjectModuleInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectModuleInfo {
    pub name: String,
    pub category: String,
    pub icon: String,
    pub files: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetDependenciesResponse {
    pub dependencies: Vec<DependencyInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DependencyInfo {
    pub name: String,
    pub version: Option<String>,
    pub kind: String,
    pub ecosystem: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetArchitectureResponse {
    pub pattern: String,
    pub confidence: u8,
    pub evidence: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectOverviewResponse {
    pub workspace_root: String,
    pub languages: Vec<String>,
    pub frameworks: Vec<FrameworkSummary>,
    pub architecture_pattern: String,
    pub architecture_confidence: u8,
    pub scan_duration_ms: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FrameworkSummary {
    pub name: String,
    pub version: Option<String>,
    pub category: String,
    pub confidence: u8,
}

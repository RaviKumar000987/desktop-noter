use napi_derive::napi;
use napi::bindgen_prelude::*;
use std::sync::{Mutex, OnceLock};
use noter_project_engine::{
    ProjectEngineService,
    FrameworkCategory, DepKind, Ecosystem,
};

// ── Singleton engine (one cache shared across all calls) ──────────────────────

static ENGINE: OnceLock<Mutex<ProjectEngineService>> = OnceLock::new();

fn engine() -> &'static Mutex<ProjectEngineService> {
    ENGINE.get_or_init(|| Mutex::new(ProjectEngineService::new()))
}

// ── JS-facing types (all fields must be plain, no enums) ──────────────────────

#[napi(object)]
pub struct JsFrameworkInfo {
    pub name: String,
    pub version: Option<String>,
    pub confidence: u32,
    pub category: String,
}

#[napi(object)]
pub struct JsDependencyNode {
    pub name: String,
    pub version: Option<String>,
    pub kind: String,
    pub ecosystem: String,
}

#[napi(object)]
pub struct JsArchitectureInfo {
    pub pattern: String,
    pub confidence: u32,
    pub evidence: Vec<String>,
}

#[napi(object)]
pub struct JsProjectModule {
    pub name: String,
    pub category: String,
    pub icon: String,
    pub files: Vec<String>,
}

#[napi(object)]
pub struct JsProjectMap {
    pub modules: Vec<JsProjectModule>,
}

#[napi(object)]
pub struct JsProjectInfo {
    pub workspace_root: String,
    pub languages: Vec<String>,
    pub frameworks: Vec<JsFrameworkInfo>,
    pub dependencies: Vec<JsDependencyNode>,
    pub architecture: JsArchitectureInfo,
    pub project_map: JsProjectMap,
    pub scan_duration_ms: u32,
}

// ── NAPI functions ────────────────────────────────────────────────────────────

/// Scan a workspace and return full project intelligence.
/// Results are cached by manifest hash — fast on repeated calls.
#[napi]
pub fn scan_project_workspace(root: String) -> Result<JsProjectInfo> {
    let mut guard = engine()
        .lock()
        .map_err(|e| Error::from_reason(e.to_string()))?;

    let info = guard
        .scan(&root)
        .map_err(|e| Error::from_reason(e.to_string()))?;

    Ok(JsProjectInfo {
        workspace_root: info.workspace_root,
        languages:      info.languages,
        scan_duration_ms: info.scan_duration_ms.min(u32::MAX as u64) as u32,
        frameworks: info.frameworks.into_iter().map(|f| JsFrameworkInfo {
            name:       f.name,
            version:    f.version,
            confidence: f.confidence as u32,
            category:   format_category(&f.category),
        }).collect(),
        dependencies: info.dependencies.into_iter().map(|d| JsDependencyNode {
            name:      d.name,
            version:   d.version,
            kind:      format_dep_kind(&d.kind),
            ecosystem: format_ecosystem(&d.ecosystem),
        }).collect(),
        architecture: JsArchitectureInfo {
            pattern:    info.architecture.pattern.to_string(),
            confidence: info.architecture.confidence as u32,
            evidence:   info.architecture.evidence,
        },
        project_map: JsProjectMap {
            modules: info.project_map.modules.into_iter().map(|m| JsProjectModule {
                name:     m.name,
                category: m.category.label().to_string(),
                icon:     m.icon,
                files:    m.files,
            }).collect(),
        },
    })
}

/// Force-invalidate cached scan for a workspace root.
#[napi]
pub fn invalidate_project_cache(root: String) -> Result<()> {
    engine()
        .lock()
        .map_err(|e| Error::from_reason(e.to_string()))?
        .invalidate_cache(&root);
    Ok(())
}

// ── Converters ────────────────────────────────────────────────────────────────

fn format_category(c: &FrameworkCategory) -> String {
    match c {
        FrameworkCategory::Ui       => "UI",
        FrameworkCategory::Backend  => "Backend",
        FrameworkCategory::Orm      => "ORM",
        FrameworkCategory::Auth     => "Auth",
        FrameworkCategory::Database => "Database",
        FrameworkCategory::Testing  => "Testing",
        FrameworkCategory::Build    => "Build",
        FrameworkCategory::Runtime  => "Runtime",
        FrameworkCategory::Other    => "Other",
    }.to_string()
}

fn format_dep_kind(k: &DepKind) -> String {
    match k {
        DepKind::Direct => "direct",
        DepKind::Dev    => "dev",
        DepKind::Peer   => "peer",
    }.to_string()
}

fn format_ecosystem(e: &Ecosystem) -> String {
    match e {
        Ecosystem::Npm      => "npm",
        Ecosystem::Cargo    => "cargo",
        Ecosystem::Pip      => "pip",
        Ecosystem::Go       => "go",
        Ecosystem::Maven    => "maven",
        Ecosystem::Gradle   => "gradle",
        Ecosystem::Composer => "composer",
    }.to_string()
}

use serde::{Deserialize, Serialize};

// ─── Project snapshot ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInfo {
    pub workspace_root: String,
    pub languages: Vec<String>,
    pub frameworks: Vec<FrameworkInfo>,
    pub dependencies: Vec<DependencyNode>,
    pub architecture: ArchitectureInfo,
    pub project_map: ProjectMap,
    pub scan_duration_ms: u64,
}

// ─── Frameworks ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkInfo {
    pub name: String,
    pub version: Option<String>,
    /// 0–100
    pub confidence: u8,
    pub category: FrameworkCategory,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FrameworkCategory {
    Ui,
    Backend,
    Orm,
    Auth,
    Database,
    Testing,
    Build,
    Runtime,
    Other,
}

impl std::fmt::Display for FrameworkCategory {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Ui       => write!(f, "UI"),
            Self::Backend  => write!(f, "Backend"),
            Self::Orm      => write!(f, "ORM"),
            Self::Auth     => write!(f, "Auth"),
            Self::Database => write!(f, "Database"),
            Self::Testing  => write!(f, "Testing"),
            Self::Build    => write!(f, "Build"),
            Self::Runtime  => write!(f, "Runtime"),
            Self::Other    => write!(f, "Other"),
        }
    }
}

// ─── Dependencies ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyNode {
    pub name: String,
    pub version: Option<String>,
    pub kind: DepKind,
    pub ecosystem: Ecosystem,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DepKind {
    Direct,
    Dev,
    Peer,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Ecosystem {
    Npm,
    Cargo,
    Pip,
    Go,
    Maven,
    Gradle,
    Composer,
}

// ─── Architecture ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchitectureInfo {
    pub pattern: ArchPattern,
    /// 0–100
    pub confidence: u8,
    pub evidence: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ArchPattern {
    Mvc,
    Layered,
    Clean,
    Hexagonal,
    Monolith,
    Microservice,
    NextJs,
    SpaFrontend,
    Library,
    Unknown,
}

impl std::fmt::Display for ArchPattern {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Mvc         => write!(f, "MVC"),
            Self::Layered     => write!(f, "Layered"),
            Self::Clean       => write!(f, "Clean Architecture"),
            Self::Hexagonal   => write!(f, "Hexagonal"),
            Self::Monolith    => write!(f, "Monolith"),
            Self::Microservice => write!(f, "Microservice"),
            Self::NextJs      => write!(f, "Next.js"),
            Self::SpaFrontend => write!(f, "SPA Frontend"),
            Self::Library     => write!(f, "Library"),
            Self::Unknown     => write!(f, "Unknown"),
        }
    }
}

// ─── Project Map ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMap {
    pub modules: Vec<ProjectModule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectModule {
    pub name: String,
    pub category: ModuleCategory,
    pub icon: String,
    pub files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[serde(rename_all = "lowercase")]
pub enum ModuleCategory {
    Authentication,
    Database,
    Api,
    Ui,
    Utilities,
    Configuration,
    Testing,
    Build,
    Docs,
}

impl ModuleCategory {
    pub fn icon(&self) -> &'static str {
        match self {
            Self::Authentication => "lock",
            Self::Database       => "database",
            Self::Api            => "globe",
            Self::Ui             => "layout",
            Self::Utilities      => "tool",
            Self::Configuration  => "settings",
            Self::Testing        => "beaker",
            Self::Build          => "package",
            Self::Docs           => "file-text",
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            Self::Authentication => "Authentication",
            Self::Database       => "Database",
            Self::Api            => "API",
            Self::Ui             => "UI",
            Self::Utilities      => "Utilities",
            Self::Configuration  => "Configuration",
            Self::Testing        => "Testing",
            Self::Build          => "Build",
            Self::Docs           => "Documentation",
        }
    }
}

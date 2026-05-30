use serde::{Deserialize, Serialize};

// ── Node types ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum NodeKind {
    /// A source file (entry point for all edges)
    File,
    /// Top-level function declaration
    Function,
    /// Class declaration
    Class,
    /// Method inside a class
    Method,
    /// TypeScript interface / abstract type
    Interface,
    /// const / let / var top-level
    Variable,
    /// Enum declaration
    Enum,
    /// Type alias (TypeScript `type X = ...`)
    Type,
    /// Namespace / module block
    Module,
}

impl std::fmt::Display for NodeKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", match self {
            Self::File      => "file",
            Self::Function  => "function",
            Self::Class     => "class",
            Self::Method    => "method",
            Self::Interface => "interface",
            Self::Variable  => "variable",
            Self::Enum      => "enum",
            Self::Type      => "type",
            Self::Module    => "module",
        })
    }
}

// ── Edge types ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum EdgeKind {
    /// File A statically imports File B (from './auth')
    Imports,
    /// File F contains Symbol S (F → S)
    Contains,
    /// File F exports Symbol S publicly
    Exports,
    /// Symbol A calls Symbol B (requires LSP — Phase 2.1+)
    Calls,
    /// Symbol A uses/references Symbol B
    References,
    /// Class A implements Interface B
    Implements,
    /// Class A extends Class B
    Extends,
}

impl std::fmt::Display for EdgeKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

// ── Graph node payload ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    pub name: String,
    pub kind: NodeKind,
    /// Workspace-relative path, forward slashes
    pub file: String,
    pub line: u32,
    pub is_exported: bool,
    pub language: String,
}

impl GraphNode {
    pub fn file_node(path: &str, language: &str) -> Self {
        Self {
            name: basename(path),
            kind: NodeKind::File,
            file: path.to_string(),
            line: 0,
            is_exported: false,
            language: language.to_string(),
        }
    }
}

// ── Analysis result types ─────────────────────────────────────────────────────

/// Impact of deleting / changing a file or symbol
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImpactResult {
    pub target_name: String,
    pub target_file: String,
    /// Files that (transitively) import the target
    pub affected_files: Vec<String>,
    /// Symbol names that reference the target
    pub affected_symbols: Vec<String>,
    pub affected_file_count: usize,
    pub affected_symbol_count: usize,
    /// Longest dependency chain depth
    pub max_depth: usize,
}

/// A detected import cycle (circular dependency)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyCycle {
    /// Files in the cycle, in order
    pub files: Vec<String>,
}

/// An exported symbol with no incoming references (dead code candidate)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnusedSymbol {
    pub name: String,
    pub file: String,
    pub line: u32,
    pub kind: String,
}

/// Architecture layer violation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchViolation {
    pub description: String,
    pub from_file: String,
    pub to_file: String,
    pub rule: String,
}

/// Graph-wide build statistics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct GraphBuildStats {
    pub file_count: usize,
    pub symbol_count: usize,
    pub edge_count: usize,
    pub import_edge_count: usize,
    pub unresolved_import_count: usize,
    pub duration_ms: u64,
}

// ── Raw analysis types (used by extractor) ───────────────────────────────────

#[derive(Debug, Clone)]
pub struct ExtractedSymbol {
    pub name: String,
    pub kind: NodeKind,
    pub line: u32,
    pub is_exported: bool,
}

#[derive(Debug, Clone)]
pub struct ExtractedImport {
    /// The raw string from the import statement (e.g. "./auth", "../utils")
    pub path: String,
    /// Specific names imported (e.g. ["login", "logout"]), or empty for namespace imports
    pub names: Vec<String>,
    pub is_type_only: bool,
}

#[derive(Debug, Clone)]
pub struct FileAnalysis {
    pub file_path: String,
    pub language: String,
    pub symbols: Vec<ExtractedSymbol>,
    pub imports: Vec<ExtractedImport>,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

pub fn basename(path: &str) -> String {
    path.replace('\\', "/").split('/').last().unwrap_or(path).to_string()
}

pub fn language_from_ext(ext: &str) -> &'static str {
    match ext {
        "ts" | "tsx"        => "typescript",
        "js" | "jsx" | "mjs" | "cjs" => "javascript",
        "py"                => "python",
        "rs"                => "rust",
        "go"                => "go",
        "java"              => "java",
        "cs"                => "csharp",
        "rb"                => "ruby",
        "php"               => "php",
        _                   => "unknown",
    }
}

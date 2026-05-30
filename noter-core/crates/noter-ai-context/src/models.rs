use serde::{Deserialize, Serialize};

// ── Project summary ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProjectSummary {
    pub language:     String,
    pub framework:    Option<String>,
    pub architecture: Option<String>,
    pub database:     Option<String>,
    pub orm:          Option<String>,
    pub auth_system:  Option<String>,
}

// ── Symbol reference (lightweight — just what AI needs) ───────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextSymbol {
    pub id:        String,
    pub name:      String,
    pub kind:      String,   // "function" | "method" | "class" | "interface"
    pub file:      String,
    pub line:      u32,
    pub container: Option<String>,
}

// ── Ranked symbol (with score) ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RankedSymbol {
    pub symbol: ContextSymbol,
    pub score:  f32,    // 0.0–100.0
    pub reason: String, // human-readable: "name match +60, auth module +10"
}

// ── File snippet (source code around a symbol) ────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSnippet {
    pub file:       String,
    pub language:   String,
    pub start_line: u32,
    pub end_line:   u32,
    pub content:    String,
    pub symbol_name: Option<String>, // which symbol this snippet was pulled for
}

// ── Full assembled context ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiContext {
    pub query:           String,
    pub project:         ProjectSummary,
    pub ranked_symbols:  Vec<RankedSymbol>,
    pub file_snippets:   Vec<FileSnippet>,
    pub build_time_ms:   u64,
    pub symbol_count:    usize,
    pub token_estimate:  usize, // rough estimate of context tokens
}

// ── Formatted prompt (ready for API) ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiPrompt {
    pub system:  String,
    pub user:    String,
    pub model:   String,
}

// ── Build stats ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ContextBuildStats {
    pub candidates_found:   usize,
    pub ranked_count:       usize,
    pub snippets_read:      usize,
    pub build_time_ms:      u64,
    pub token_estimate:     usize,
}

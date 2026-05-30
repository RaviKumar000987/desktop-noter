use serde::{Deserialize, Serialize};

// ── Re-use SymbolId type from noter-core-api ──────────────────────────────────
// SymbolId is a Uuid v5 — deterministic from (file, name, kind, line)
pub type SymbolId = String;

// ── Call graph edges ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallEdge {
    pub caller_id:      SymbolId,
    pub callee_id:      Option<SymbolId>, // None until resolver fills it
    pub callee_name:    String,           // raw extracted name (pre-resolution)
    pub call_site_file: String,
    pub call_site_line: u32,
    pub call_site_col:  u32,
    pub is_async:       bool,
    /// 100 = tree-sitter extracted, 70 = regex fallback
    pub confidence:     u8,
}

// ── Symbol reference (what callers/callees return) ────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolRef {
    pub id:        SymbolId,
    pub name:      String,
    /// "function" | "method" | "constructor" | "arrow" | "closure"
    pub kind:      String,
    pub file:      String,
    pub line:      u32,
    pub container: Option<String>, // class or module name
}

// ── Execution flow ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowPath {
    pub steps:             Vec<FlowStep>,
    pub max_depth_reached: bool,
    pub total_hops:        usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowStep {
    pub symbol:           SymbolRef,
    pub via_file:         String,
    pub via_line:         u32,
}

// ── Impact analysis ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImpactReport {
    pub symbol_id:        SymbolId,
    pub symbol_name:      String,
    pub direct_callers:   Vec<SymbolRef>,
    pub transitive_count: usize, // total upstream callers via BFS
}

// ── Build stats ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CallGraphStats {
    pub file_count:       usize,
    pub raw_edge_count:   usize,
    pub resolved_count:   usize,
    pub unresolved_count: usize,
    pub duration_ms:      u64,
}

use serde::{Deserialize, Serialize};
use noter_core_api::Symbol;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextSnapshot {
    pub open_file: String,
    pub cursor_symbol: Option<Symbol>,
    pub related_symbols: Vec<Symbol>,
    pub file_imports: Vec<String>,
    pub callers: Vec<String>,
    pub recent_edits: Vec<String>,
}

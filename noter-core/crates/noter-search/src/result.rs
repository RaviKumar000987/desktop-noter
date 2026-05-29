use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub file: String,
    pub line: u32,
    pub column: u32,
    pub text: String,
    pub match_start: usize,
    pub match_end: usize,
}

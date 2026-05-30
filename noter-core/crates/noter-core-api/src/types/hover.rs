use serde::{Deserialize, Serialize};
use crate::types::location::Range;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum MarkedString {
    PlainText { value: String },
    Markdown { value: String },
    Code { language: String, value: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hover {
    pub contents: Vec<MarkedString>,
    pub range: Option<Range>,
}

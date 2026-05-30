use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CompletionKind {
    Text, Method, Function, Constructor, Field, Variable, Class,
    Interface, Module, Property, Unit, Value, Enum, Keyword,
    Snippet, Color, File, Reference, Folder, EnumMember,
    Constant, Struct, Event, Operator, TypeParameter,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionItem {
    pub label: String,
    pub kind: Option<CompletionKind>,
    pub detail: Option<String>,
    pub documentation: Option<String>,
    pub insert_text: Option<String>,
    pub sort_text: Option<String>,
    pub filter_text: Option<String>,
    /// True if insert_text contains a snippet (tab stops, placeholders).
    pub is_snippet: bool,
}

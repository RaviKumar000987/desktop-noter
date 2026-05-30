use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::types::location::{FileRef, Range};

/// Deterministic, rename-stable ID for a symbol.
/// Generated via UUID v5 (SHA-1 hash) over file_uri + name + line.
/// Two symbols with the same name at the same location always get the same ID,
/// but collisions across files or lines are impossible.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SymbolId(pub Uuid);

impl SymbolId {
    pub fn new(file_uri: &str, name: &str, line: u32) -> Self {
        let key = format!("{}::{}:{}", file_uri, name, line);
        Self(Uuid::new_v5(&Uuid::NAMESPACE_URL, key.as_bytes()))
    }

    /// Parse a UUID string previously produced by `to_string()`.
    /// Returns None only if the string is corrupt — should never happen for DB-stored IDs.
    pub fn from_str(s: &str) -> Option<Self> {
        Uuid::parse_str(s).ok().map(Self)
    }
}

impl std::fmt::Display for SymbolId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Full LSP SymbolKind set — never add language-specific variants here.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SymbolKind {
    File, Module, Namespace, Package,
    Class, Method, Property, Field, Constructor,
    Enum, EnumMember,
    Interface,
    Function, Variable, Constant,
    String, Number, Boolean, Array, Object, Key, Null,
    Struct, Event, Operator, TypeParameter,
    Import, Export,
    Unknown,
}

impl Default for SymbolKind {
    fn default() -> Self { Self::Unknown }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Symbol {
    pub id: SymbolId,
    pub name: String,
    pub kind: SymbolKind,
    pub file: FileRef,
    pub range: Range,
    /// Enclosing class/function/module name, if any.
    pub container: Option<String>,
}

impl Symbol {
    pub fn new(
        name: impl Into<String>,
        kind: SymbolKind,
        file: FileRef,
        range: Range,
        container: Option<String>,
    ) -> Self {
        let name = name.into();
        let id = SymbolId::new(&file.uri, &name, range.start.line);
        Self { id, name, kind, file, range, container }
    }
}

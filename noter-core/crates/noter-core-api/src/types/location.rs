use serde::{Deserialize, Serialize};

/// Stable reference to a file inside or outside the workspace.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct FileRef {
    /// Absolute file URI, e.g. "file:///home/user/project/src/main.rs"
    pub uri: String,
    /// Path relative to workspace root, e.g. "src/main.rs". Empty when outside workspace.
    pub workspace_relative: String,
}

impl FileRef {
    pub fn from_path(abs_path: &str, workspace_root: &str) -> Self {
        let uri = format!("file:///{}", abs_path.replace('\\', "/").trim_start_matches('/'));
        let workspace_relative = abs_path
            .strip_prefix(workspace_root)
            .unwrap_or("")
            .trim_start_matches(['/', '\\'])
            .to_string();
        Self { uri, workspace_relative }
    }

    pub fn from_uri(uri: &str) -> Self {
        Self {
            uri: uri.to_string(),
            workspace_relative: String::new(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Position {
    pub line: u32,
    pub character: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

impl Range {
    pub fn point(line: u32, character: u32) -> Self {
        let pos = Position { line, character };
        Self { start: pos, end: pos }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Location {
    pub file: FileRef,
    pub range: Range,
}

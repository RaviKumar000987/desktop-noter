/// Layer 3 — Cross-file Import Resolver.
///
/// Given: importing_file = "/workspace/src/auth/login.ts"
///        import_path    = "../utils"
/// Returns: "/workspace/src/utils.ts"  (workspace-relative)
///
/// Strategy:
///   1. Relative paths (starts with ./ or ../) → resolve manually (no FS call for non-existent paths)
///   2. Absolute/workspace paths (@/ prefix) → skip (needs tsconfig paths config)
///   3. Node packages → skip (external deps are in the dependency graph from Phase 1.5)
use std::path::{Path, PathBuf};

const TS_EXTS:   &[&str] = &[".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ""];
const INDEX_FILES: &[&str] = &["index.ts", "index.tsx", "index.js", "index.jsx"];

pub struct ImportResolver {
    workspace_root: String,
}

impl ImportResolver {
    pub fn new(workspace_root: &str) -> Self {
        Self { workspace_root: workspace_root.to_string() }
    }

    /// Resolve an import path to a workspace-relative forward-slash path.
    /// Returns None for:
    ///   - npm packages (no leading dot)
    ///   - workspace aliases (@/ — needs tsconfig)
    ///   - unresolvable paths
    pub fn resolve(&self, importing_file: &str, import_path: &str) -> Option<String> {
        // Only resolve relative imports for now
        if !import_path.starts_with('.') { return None; }

        let importing_dir = Path::new(importing_file).parent()?;
        let raw = importing_dir.join(import_path);
        let normalized = normalize(&raw);

        // Try with each extension
        for ext in TS_EXTS {
            let candidate = format!("{}{}", normalized.display(), ext);
            let path = Path::new(&candidate);
            if path.exists() {
                return Some(to_workspace_rel(&candidate, &self.workspace_root));
            }
        }

        // Try as directory with index file
        for index in INDEX_FILES {
            let candidate = normalized.join(index);
            if candidate.exists() {
                return Some(to_workspace_rel(
                    candidate.to_str().unwrap_or(""),
                    &self.workspace_root,
                ));
            }
        }

        None
    }
}

/// Normalize path (collapse `..` and `.` without calling the OS).
fn normalize(path: &Path) -> PathBuf {
    let mut result = PathBuf::new();
    for component in path.components() {
        match component {
            std::path::Component::ParentDir => { result.pop(); }
            std::path::Component::CurDir    => {}
            c                               => result.push(c.as_os_str()),
        }
    }
    result
}

fn to_workspace_rel(abs: &str, root: &str) -> String {
    let abs_norm = abs.replace('\\', "/");
    let root_norm = root.replace('\\', "/").trim_end_matches('/').to_string();
    abs_norm
        .strip_prefix(&root_norm)
        .unwrap_or(&abs_norm)
        .trim_start_matches('/')
        .to_string()
}

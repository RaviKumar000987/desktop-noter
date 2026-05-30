use std::path::Path;
use anyhow::Result;
use rayon::prelude::*;
use walkdir::WalkDir;
use tracing::{info, debug};

use noter_core_api::{Symbol, FileRef};
use crate::languages::get_language;

pub struct WorkspaceIndexer;

impl WorkspaceIndexer {
    pub fn new() -> Self {
        Self
    }

    pub fn index_workspace(&self, root: &str) -> Result<Vec<Symbol>> {
        let files: Vec<_> = WalkDir::new(root)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_file())
            .filter(|e| {
                e.path()
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| get_language(ext).is_some())
                    .unwrap_or(false)
            })
            .collect();

        info!("Indexing {} files in {}", files.len(), root);

        let symbols: Vec<Symbol> = files
            .par_iter()
            .flat_map(|entry| self.index_file(entry.path(), root).unwrap_or_default())
            .collect();

        debug!("Found {} symbols", symbols.len());
        Ok(symbols)
    }

    fn index_file(&self, path: &Path, workspace_root: &str) -> Result<Vec<Symbol>> {
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        let lang = match get_language(ext) {
            Some(l) => l,
            None => return Ok(vec![]),
        };

        let source = std::fs::read_to_string(path)?;
        let mut parser = tree_sitter::Parser::new();
        parser.set_language(&lang)?;

        let _tree = parser.parse(&source, None);
        let _file = FileRef::from_path(path.to_str().unwrap_or(""), workspace_root);

        // TODO: walk tree nodes and extract symbols — placeholder until query strings added per language
        Ok(vec![])
    }
}

impl Default for WorkspaceIndexer {
    fn default() -> Self { Self::new() }
}

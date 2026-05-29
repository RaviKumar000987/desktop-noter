use std::path::Path;
use rayon::prelude::*;
use ignore::WalkBuilder;
use memmap2::Mmap;
use std::fs::File;
use anyhow::Result;
use tracing::debug;

use crate::{matcher::Matcher, result::SearchResult};

pub struct SearchEngine;

impl SearchEngine {
    pub fn new() -> Self {
        Self
    }

    pub fn search(
        &self,
        root: &str,
        pattern: &str,
        case_sensitive: bool,
    ) -> Result<Vec<SearchResult>> {
        let matcher = Matcher::new(pattern, case_sensitive)?;

        let files: Vec<_> = WalkBuilder::new(root)
            .hidden(false)
            .git_ignore(true)
            .build()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_file())
            .collect();

        debug!("Searching {} files for '{}'", files.len(), pattern);

        let results: Vec<SearchResult> = files
            .par_iter()
            .flat_map(|entry| self.search_file(entry.path(), &matcher))
            .collect();

        Ok(results)
    }

    fn search_file(&self, path: &Path, matcher: &Matcher) -> Vec<SearchResult> {
        let file = match File::open(path) {
            Ok(f) => f,
            Err(_) => return vec![],
        };
        let mmap = match unsafe { Mmap::map(&file) } {
            Ok(m) => m,
            Err(_) => return vec![],
        };
        let content = match std::str::from_utf8(&mmap) {
            Ok(s) => s,
            Err(_) => return vec![],
        };

        let path_str = path.to_string_lossy().to_string();
        let mut results = Vec::new();

        for (line_idx, line) in content.lines().enumerate() {
            for (start, end) in matcher.find_all(line) {
                results.push(SearchResult {
                    file: path_str.clone(),
                    line: (line_idx + 1) as u32,
                    column: start as u32,
                    text: line.to_string(),
                    match_start: start,
                    match_end: end,
                });
            }
        }
        results
    }
}

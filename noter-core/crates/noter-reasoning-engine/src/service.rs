use std::collections::HashSet;
use anyhow::Result;
use walkdir::WalkDir;
use noter_code_graph::CodeGraphService;

use crate::{
    models::{ReasoningReport, LargeFile, DeadSymbol, Cycle, ArchViolation},
    risk::{compute_risk_items, is_code_file, is_test_file},
    health::{compute_health, build_recommendations},
};

const SKIP_DIRS: &[&str] = &[
    "node_modules", ".git", "dist", "build", ".next",
    "out", "coverage", ".cache", "__pycache__", "venv",
    ".venv", "target",
];
const MAX_FILES: usize = 500;

pub struct ReasoningService {
    root:  String,
    graph: CodeGraphService,
}

impl ReasoningService {
    pub fn new(root: &str) -> Self {
        Self {
            root:  root.to_string(),
            graph: CodeGraphService::new(root),
        }
    }

    pub fn analyze(&mut self) -> Result<ReasoningReport> {
        // Build graph if not already built
        if !self.graph.is_built() {
            self.graph.build()?;
        }

        // Collect raw graph data
        let dead_code: Vec<DeadSymbol> = self.graph.unused_exports()
            .unwrap_or_default()
            .into_iter()
            .map(|u| DeadSymbol { name: u.name, file: u.file, line: u.line as u32, kind: u.kind })
            .collect();

        let cycles: Vec<Cycle> = self.graph.dependency_cycles()
            .unwrap_or_default()
            .into_iter()
            .map(|c| Cycle { files: c.files })
            .collect();

        let arch_violations: Vec<ArchViolation> = self.graph.arch_violations("**")
            .unwrap_or_default()
            .into_iter()
            .map(|v| ArchViolation {
                description: v.description,
                from_file:   v.from_file,
                to_file:     v.to_file,
                rule:        v.rule,
            })
            .collect();

        // Walk workspace files
        let files = self.collect_files();

        // Build cyclic file set for risk scoring
        let cyclic_files: HashSet<String> = cycles.iter()
            .flat_map(|c| c.files.iter().cloned())
            .collect();

        let large_files: Vec<LargeFile> = files.iter()
            .filter(|f| is_code_file(f) && !is_test_file(f))
            .take(25)
            .map(|f| {
                let name = f.replace('\\', "/")
                    .rsplit('/').next().unwrap_or("").to_string();
                LargeFile { path: f.clone(), name }
            })
            .collect();

        let risk_items = compute_risk_items(&files, &cyclic_files);

        let health = compute_health(
            &arch_violations, &cycles, &dead_code, &large_files, &risk_items,
        );

        let recommendations = build_recommendations(
            &arch_violations, &cycles, &dead_code, &large_files, &risk_items,
        );

        Ok(ReasoningReport {
            dead_code,
            cycles,
            arch_violations,
            large_files,
            risk_items,
            health,
            recommendations,
        })
    }

    fn collect_files(&self) -> Vec<String> {
        let mut files = Vec::with_capacity(256);
        for entry in WalkDir::new(&self.root)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| {
                let name = e.file_name().to_string_lossy();
                !name.starts_with('.') && !SKIP_DIRS.iter().any(|d| name == *d)
            })
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            if files.len() >= MAX_FILES { break; }
            files.push(entry.path().to_string_lossy().into_owned());
        }
        files
    }

    pub fn invalidate(&mut self) {
        self.graph.invalidate();
    }
}

/// CodeGraphService — manages the graph lifecycle.
///
/// Owns: CodeGraphData + last build stats.
/// Supports:
///   build()         — full initial build
///   update_file()   — incremental file rebuild (< 100ms, triggered by Phase 1.75)
///   query()         — returns a QueryEngine borrowing from the data
///   invalidate()    — drop graph (force rebuild on next build())
use std::time::Instant;
use anyhow::Result;
use tracing::info;

use crate::analysis;
use crate::builder;
use crate::graph::CodeGraphData;
use crate::models::{ArchViolation, DependencyCycle, GraphBuildStats, ImpactResult, UnusedSymbol};
use crate::query::QueryEngine;

pub struct CodeGraphService {
    pub workspace_root: String,
    data: Option<CodeGraphData>,
    pub last_stats: Option<GraphBuildStats>,
}

impl CodeGraphService {
    pub fn new(workspace_root: &str) -> Self {
        Self { workspace_root: workspace_root.to_string(), data: None, last_stats: None }
    }

    /// Full graph build. Call on workspace open or after invalidate().
    pub fn build(&mut self) -> Result<GraphBuildStats> {
        let (data, stats) = builder::build(&self.workspace_root);
        self.last_stats = Some(stats.clone());
        self.data = Some(data);
        Ok(stats)
    }

    /// Ensure graph is built (idempotent).
    pub fn ensure_built(&mut self) -> Result<()> {
        if self.data.is_none() { self.build()?; }
        Ok(())
    }

    /// Incremental file update — rebuild only the nodes/edges for one file.
    /// Phase 1.75 WatchEngine calls this on FileReindexed events.
    pub fn update_file(&mut self, file_rel: &str) -> bool {
        match &mut self.data {
            None => false,
            Some(data) => {
                let start = Instant::now();
                let existed = builder::rebuild_file(data, &self.workspace_root, file_rel);
                info!(
                    "code-graph: incremental update '{}' in {}ms",
                    file_rel, start.elapsed().as_millis()
                );
                existed
            }
        }
    }

    /// Drop the graph — next query will trigger a rebuild.
    pub fn invalidate(&mut self) {
        self.data = None;
        self.last_stats = None;
    }

    // ── Query delegation ──────────────────────────────────────────────────────

    pub fn impact_of(&mut self, file: &str) -> Result<ImpactResult> {
        self.ensure_built()?;
        let q = QueryEngine::new(self.data.as_ref().unwrap());
        Ok(q.analyze_impact(file))
    }

    pub fn unused_exports(&mut self) -> Result<Vec<UnusedSymbol>> {
        self.ensure_built()?;
        let q = QueryEngine::new(self.data.as_ref().unwrap());
        Ok(q.find_unused_exports())
    }

    pub fn dependency_cycles(&mut self) -> Result<Vec<DependencyCycle>> {
        self.ensure_built()?;
        let q = QueryEngine::new(self.data.as_ref().unwrap());
        Ok(q.find_cycles())
    }

    pub fn arch_violations(&mut self, pattern: &str) -> Result<Vec<ArchViolation>> {
        self.ensure_built()?;
        Ok(analysis::detect_violations(self.data.as_ref().unwrap(), pattern))
    }

    pub fn file_imports(&mut self, file: &str) -> Result<Vec<crate::models::GraphNode>> {
        self.ensure_built()?;
        let q = QueryEngine::new(self.data.as_ref().unwrap());
        Ok(q.file_imports(file).iter()
            .filter_map(|&id| self.data.as_ref().unwrap().node(id).cloned())
            .collect())
    }

    pub fn file_importers(&mut self, file: &str) -> Result<Vec<crate::models::GraphNode>> {
        self.ensure_built()?;
        let q = QueryEngine::new(self.data.as_ref().unwrap());
        Ok(q.file_importers(file).iter()
            .filter_map(|&id| self.data.as_ref().unwrap().node(id).cloned())
            .collect())
    }

    pub fn find_path(&mut self, from: &str, to: &str) -> Result<Option<Vec<String>>> {
        self.ensure_built()?;
        let q = QueryEngine::new(self.data.as_ref().unwrap());
        Ok(q.find_path(from, to))
    }

    pub fn node_by_name(&mut self, name: &str) -> Result<Vec<crate::models::GraphNode>> {
        self.ensure_built()?;
        let data = self.data.as_ref().unwrap();
        Ok(data.find_by_name(name).iter()
            .filter_map(|&id| data.node(id).cloned())
            .collect())
    }

    pub fn is_built(&self) -> bool { self.data.is_some() }

    pub fn stats(&self) -> Option<&GraphBuildStats> { self.last_stats.as_ref() }
}

/// SymbolIntelligenceService — public API consumed by the NAPI bridge.
///
/// One instance per workspace root, held in a HashMap<String, Service>
/// via the NAPI-layer OnceLock. The in-memory graph is always in sync
/// with the last successful build or file-level incremental update.
use anyhow::Result;
use tracing::info;
use crate::{
    cache::MemoryCallGraph,
    call_graph::{builder, resolver},
    db::storage,
    flow::{impact, tracer},
    models::{CallEdge, CallGraphStats, FlowPath, ImpactReport, SymbolRef},
    query::{callers, callees, implementations},
};

pub struct SymbolIntelligenceService {
    pub workspace_root: String,
    pub graph:          MemoryCallGraph,
    pub stats:          Option<CallGraphStats>,
}

impl SymbolIntelligenceService {
    pub fn new(workspace_root: String) -> Self {
        Self { workspace_root, graph: MemoryCallGraph::new(), stats: None }
    }

    // ── Build / hydrate ───────────────────────────────────────────────────────

    /// Full workspace build: extract → resolve → persist → hydrate RAM graph.
    pub fn build_call_graph(
        &mut self,
        symbol_db_path: &str,
        call_db_path: &str,
    ) -> Result<CallGraphStats> {
        let (edges, stats) = builder::build(&self.workspace_root, symbol_db_path, call_db_path)?;
        self.hydrate_graph(edges);
        self.stats = Some(stats.clone());
        Ok(stats)
    }

    /// Load persisted edges from SQLite (faster cold start — skips re-extraction).
    pub fn hydrate_from_db(&mut self, call_db_path: &str) -> Result<usize> {
        let edges = storage::load(&self.workspace_root, call_db_path)?;
        let count = edges.len();
        self.hydrate_graph(edges);
        info!("symbol-intelligence: hydrated {} edges from SQLite", count);
        Ok(count)
    }

    /// Incremental update for a single file.
    pub fn update_file(
        &mut self,
        file_path: &str,
        symbol_db_path: &str,
        call_db_path: &str,
    ) -> Result<usize> {
        // Remove old edges for this file from RAM graph
        self.graph.remove_file_edges(file_path);
        // Re-extract and resolve for the file
        let new_edges = builder::build_file(file_path, &self.workspace_root, symbol_db_path, call_db_path)?;
        let count = new_edges.len();
        // Insert into RAM graph
        for edge in new_edges {
            self.graph.insert_edge(edge);
        }
        Ok(count)
    }

    // ── Queries (all hit RAM graph — sub-ms) ─────────────────────────────────

    pub fn find_callers(&self, symbol_id: &str, symbol_db_path: &str) -> Result<Vec<SymbolRef>> {
        callers::find_callers(symbol_id, &self.graph, symbol_db_path)
    }

    pub fn find_callees(&self, symbol_id: &str, symbol_db_path: &str) -> Result<Vec<SymbolRef>> {
        callees::find_callees(symbol_id, &self.graph, symbol_db_path)
    }

    pub fn find_implementations(&self, interface_name: &str, symbol_db_path: &str) -> Result<Vec<SymbolRef>> {
        implementations::find_implementations(interface_name, symbol_db_path)
    }

    pub fn trace_flow(&self, start_id: &str, max_depth: u8, symbol_db_path: &str) -> Result<FlowPath> {
        tracer::trace_flow(start_id, max_depth, &self.graph, symbol_db_path)
    }

    pub fn get_impact(&self, symbol_id: &str, symbol_db_path: &str) -> Result<ImpactReport> {
        impact::get_impact(symbol_id, &self.graph, symbol_db_path)
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

    pub fn graph_stats(&self) -> (usize, usize) {
        (self.graph.node_count(), self.graph.edge_count())
    }

    // ── Private ───────────────────────────────────────────────────────────────

    fn hydrate_graph(&mut self, edges: Vec<CallEdge>) {
        self.graph = MemoryCallGraph::new();
        for edge in edges {
            self.graph.insert_edge(edge);
        }
    }
}

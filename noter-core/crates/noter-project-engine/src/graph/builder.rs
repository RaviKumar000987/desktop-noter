/// Layer 3 — dependency graph.
/// Builds an adjacency list from direct → peer dependencies.
/// Phase 2 (AI Context Engine) will promote this to a full petgraph DiGraph.
use crate::models::DependencyNode;
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct DependencyGraph {
    /// name → version of all nodes
    pub nodes: Vec<String>,
    /// direct_name → list of peer/indirect dep names (populated when lockfile is available)
    pub edges: HashMap<String, Vec<String>>,
}

pub fn build(deps: &[DependencyNode]) -> DependencyGraph {
    DependencyGraph {
        nodes: deps.iter().map(|d| d.name.clone()).collect(),
        edges: HashMap::new(),
    }
}

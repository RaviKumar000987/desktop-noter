use petgraph::graph::{DiGraph, NodeIndex};
use std::collections::HashMap;

use noter_core_api::SymbolId;
use crate::edge::EdgeKind;

pub struct WorkspaceGraph {
    graph: DiGraph<SymbolId, EdgeKind>,
    node_map: HashMap<SymbolId, NodeIndex>,
}

impl WorkspaceGraph {
    pub fn new() -> Self {
        Self {
            graph: DiGraph::new(),
            node_map: HashMap::new(),
        }
    }

    pub fn add_node(&mut self, id: SymbolId) -> NodeIndex {
        if let Some(&idx) = self.node_map.get(&id) {
            return idx;
        }
        let idx = self.graph.add_node(id.clone());
        self.node_map.insert(id, idx);
        idx
    }

    pub fn add_edge(&mut self, from: SymbolId, to: SymbolId, kind: EdgeKind) {
        let a = self.add_node(from);
        let b = self.add_node(to);
        self.graph.add_edge(a, b, kind);
    }

    /// Returns all symbols that reference (call / import / extend) the given symbol.
    pub fn references_to(&self, id: &SymbolId) -> Vec<SymbolId> {
        let Some(&idx) = self.node_map.get(id) else {
            return vec![];
        };
        self.graph
            .neighbors_directed(idx, petgraph::Direction::Incoming)
            .map(|n| self.graph[n].clone())
            .collect()
    }

    /// Returns all symbols that the given symbol references (calls / imports / extends).
    pub fn references_from(&self, id: &SymbolId) -> Vec<SymbolId> {
        let Some(&idx) = self.node_map.get(id) else {
            return vec![];
        };
        self.graph
            .neighbors_directed(idx, petgraph::Direction::Outgoing)
            .map(|n| self.graph[n].clone())
            .collect()
    }

    pub fn node_count(&self) -> usize { self.graph.node_count() }
    pub fn edge_count(&self) -> usize { self.graph.edge_count() }
}

impl Default for WorkspaceGraph {
    fn default() -> Self { Self::new() }
}

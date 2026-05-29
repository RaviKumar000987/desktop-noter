use petgraph::graph::{DiGraph, NodeIndex};
use std::collections::HashMap;

use crate::edge::EdgeKind;

pub struct WorkspaceGraph {
    graph: DiGraph<String, EdgeKind>,
    node_map: HashMap<String, NodeIndex>,
}

impl WorkspaceGraph {
    pub fn new() -> Self {
        Self {
            graph: DiGraph::new(),
            node_map: HashMap::new(),
        }
    }

    pub fn add_node(&mut self, id: &str) -> NodeIndex {
        if let Some(&idx) = self.node_map.get(id) {
            return idx;
        }
        let idx = self.graph.add_node(id.to_string());
        self.node_map.insert(id.to_string(), idx);
        idx
    }

    pub fn add_edge(&mut self, from: &str, to: &str, kind: EdgeKind) {
        let a = self.add_node(from);
        let b = self.add_node(to);
        self.graph.add_edge(a, b, kind);
    }

    pub fn references_to(&self, symbol: &str) -> Vec<String> {
        let Some(&idx) = self.node_map.get(symbol) else {
            return vec![];
        };
        self.graph
            .neighbors_directed(idx, petgraph::Direction::Incoming)
            .map(|n| self.graph[n].clone())
            .collect()
    }

    pub fn node_count(&self) -> usize {
        self.graph.node_count()
    }

    pub fn edge_count(&self) -> usize {
        self.graph.edge_count()
    }
}

/// Layer 2 — The central graph data structure.
///
/// Uses `petgraph::stable_graph::StableDiGraph` (not DiGraph) because:
///   - StableDiGraph preserves NodeIndex across node removal
///   - Critical for incremental updates: remove file's nodes, re-add them
///   - DiGraph would invalidate all indices on every removal
use std::collections::HashMap;
use petgraph::stable_graph::{NodeIndex, StableDiGraph};
use petgraph::visit::EdgeRef;
use petgraph::Direction;
use serde::{Deserialize, Serialize};

use crate::models::{EdgeKind, GraphNode, NodeKind};

pub type NodeId = NodeIndex<u32>;

#[derive(Serialize, Deserialize)]
pub struct CodeGraphData {
    pub(crate) graph: StableDiGraph<GraphNode, EdgeKind>,
    /// file (workspace-relative) → NodeId of the File node
    pub(crate) file_nodes: HashMap<String, NodeId>,
    /// file → all NodeIds belonging to that file (File node + symbol nodes)
    pub(crate) file_members: HashMap<String, Vec<NodeId>>,
    /// symbol name → NodeIds (same name can exist in multiple files)
    pub(crate) name_index: HashMap<String, Vec<NodeId>>,
}

impl CodeGraphData {
    pub fn new() -> Self {
        Self {
            graph: StableDiGraph::new(),
            file_nodes: HashMap::new(),
            file_members: HashMap::new(),
            name_index: HashMap::new(),
        }
    }

    // ── Mutation ──────────────────────────────────────────────────────────────

    pub fn add_node(&mut self, node: GraphNode) -> NodeId {
        let file = node.file.clone();
        let name = node.name.clone();
        let id = self.graph.add_node(node);

        self.file_members.entry(file).or_default().push(id);
        self.name_index.entry(name).or_default().push(id);
        id
    }

    pub fn register_file_node(&mut self, file: &str, id: NodeId) {
        self.file_nodes.insert(file.to_string(), id);
    }

    pub fn add_edge(&mut self, from: NodeId, to: NodeId, kind: EdgeKind) {
        // Avoid duplicate edges of the same kind between the same pair
        if !self.graph.edges_connecting(from, to).any(|e| e.weight() == &kind) {
            self.graph.add_edge(from, to, kind);
        }
    }

    /// Remove all nodes (and their edges) belonging to a file.
    /// Used by incremental updater when a file changes.
    pub fn remove_file(&mut self, file: &str) {
        let members = self.file_members.remove(file).unwrap_or_default();
        for node_id in members {
            if let Some(node) = self.graph.remove_node(node_id) {
                // Remove from name index
                if let Some(ids) = self.name_index.get_mut(&node.name) {
                    ids.retain(|&n| n != node_id);
                }
            }
        }
        self.file_nodes.remove(file);
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    pub fn node(&self, id: NodeId) -> Option<&GraphNode> {
        self.graph.node_weight(id)
    }

    pub fn find_by_name(&self, name: &str) -> Vec<NodeId> {
        self.name_index.get(name).cloned().unwrap_or_default()
    }

    pub fn find_by_file(&self, file: &str) -> Vec<NodeId> {
        self.file_members.get(file).cloned().unwrap_or_default()
    }

    pub fn file_node_of(&self, file: &str) -> Option<NodeId> {
        self.file_nodes.get(file).copied()
    }

    /// Nodes that have edges POINTING TO `id` (who depends on this)
    pub fn predecessors(&self, id: NodeId) -> impl Iterator<Item = NodeId> + '_ {
        self.graph.neighbors_directed(id, Direction::Incoming)
    }

    /// Nodes that `id` points TO (what this depends on)
    pub fn successors(&self, id: NodeId) -> impl Iterator<Item = NodeId> + '_ {
        self.graph.neighbors_directed(id, Direction::Outgoing)
    }

    /// All outgoing edges from `id` filtered by kind
    pub fn edges_of_kind(&self, id: NodeId, kind: EdgeKind) -> Vec<NodeId> {
        self.graph
            .edges_directed(id, Direction::Outgoing)
            .filter(|e| e.weight() == &kind)
            .map(|e| e.target())
            .collect()
    }

    /// All incoming edges to `id` filtered by kind
    pub fn edges_to_of_kind(&self, id: NodeId, kind: EdgeKind) -> Vec<NodeId> {
        self.graph
            .edges_directed(id, Direction::Incoming)
            .filter(|e| e.weight() == &kind)
            .map(|e| e.source())
            .collect()
    }

    pub fn node_count(&self) -> usize { self.graph.node_count() }
    pub fn edge_count(&self) -> usize { self.graph.edge_count() }
    pub fn file_count(&self) -> usize { self.file_nodes.len() }

    pub fn all_nodes(&self) -> impl Iterator<Item = (NodeId, &GraphNode)> {
        self.graph.node_indices().filter_map(move |id| {
            self.graph.node_weight(id).map(|n| (id, n))
        })
    }

    pub fn all_file_nodes(&self) -> impl Iterator<Item = (NodeId, &GraphNode)> {
        self.graph.node_indices()
            .filter_map(move |id| self.graph.node_weight(id).map(|n| (id, n)))
            .filter(|(_, n)| n.kind == NodeKind::File)
    }

    pub fn symbol_count(&self) -> usize {
        self.graph.node_weights()
            .filter(|n| n.kind != NodeKind::File)
            .count()
    }

    pub fn import_edge_count(&self) -> usize {
        self.graph.edge_weights()
            .filter(|e| **e == EdgeKind::Imports)
            .count()
    }
}

impl Default for CodeGraphData {
    fn default() -> Self { Self::new() }
}

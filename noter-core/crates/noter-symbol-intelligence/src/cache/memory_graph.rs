/// In-memory call graph backed by petgraph StableDiGraph.
///
/// All queries (find_callers, find_callees, trace_flow) hit this in-memory
/// structure — never SQLite at query time. SQLite is only used for persistence
/// (startup hydration + background write-back after indexing).
use petgraph::stable_graph::{NodeIndex, StableDiGraph};
use petgraph::visit::EdgeRef;
use petgraph::Direction;
use std::collections::{HashMap, HashSet, VecDeque};
use crate::models::{CallEdge, FlowStep, SymbolRef};

pub struct MemoryCallGraph {
    graph:      StableDiGraph<String, CallEdge>,    // node weight = SymbolId string
    id_to_node: HashMap<String, NodeIndex>,         // SymbolId → NodeIndex (O(1) lookup)
}

impl MemoryCallGraph {
    pub fn new() -> Self {
        Self {
            graph:      StableDiGraph::new(),
            id_to_node: HashMap::new(),
        }
    }

    /// Insert or get the NodeIndex for a symbol_id.
    fn get_or_insert_node(&mut self, symbol_id: &str) -> NodeIndex {
        if let Some(&idx) = self.id_to_node.get(symbol_id) {
            return idx;
        }
        let idx = self.graph.add_node(symbol_id.to_string());
        self.id_to_node.insert(symbol_id.to_string(), idx);
        idx
    }

    /// Add a call edge. Both caller and callee must have a resolved id.
    pub fn insert_edge(&mut self, edge: CallEdge) {
        let caller_idx = self.get_or_insert_node(&edge.caller_id);
        let callee_id = match &edge.callee_id {
            Some(id) => id.clone(),
            None => return, // unresolved — not added to in-memory graph
        };
        let callee_idx = self.get_or_insert_node(&callee_id);

        // Avoid duplicate edges (same caller → same callee from same file+line)
        let duplicate = self.graph
            .edges_directed(caller_idx, Direction::Outgoing)
            .any(|e| {
                e.target() == callee_idx
                    && e.weight().call_site_file == edge.call_site_file
                    && e.weight().call_site_line == edge.call_site_line
            });

        if !duplicate {
            self.graph.add_edge(caller_idx, callee_idx, edge);
        }
    }

    /// Remove all edges whose call_site_file matches (used for incremental re-index).
    pub fn remove_file_edges(&mut self, file: &str) {
        let to_remove: Vec<_> = self.graph
            .edge_indices()
            .filter(|&ei| self.graph[ei].call_site_file == file)
            .collect();
        for ei in to_remove {
            self.graph.remove_edge(ei);
        }
    }

    /// Direct callers of `symbol_id` (one hop upstream, incoming edges).
    pub fn get_callers(&self, symbol_id: &str) -> Vec<CallEdge> {
        let idx = match self.id_to_node.get(symbol_id) {
            Some(&i) => i,
            None => return vec![],
        };
        self.graph
            .edges_directed(idx, Direction::Incoming)
            .map(|e| e.weight().clone())
            .collect()
    }

    /// Direct callees of `symbol_id` (one hop downstream, outgoing edges).
    pub fn get_callees(&self, symbol_id: &str) -> Vec<CallEdge> {
        let idx = match self.id_to_node.get(symbol_id) {
            Some(&i) => i,
            None => return vec![],
        };
        self.graph
            .edges_directed(idx, Direction::Outgoing)
            .map(|e| e.weight().clone())
            .collect()
    }

    /// BFS downstream from `start_id` up to `max_depth` hops.
    /// Returns ordered list of (callee_id, via_file, via_line).
    pub fn bfs_downstream(&self, start_id: &str, max_depth: u8) -> Vec<FlowStep> {
        let start_idx = match self.id_to_node.get(start_id) {
            Some(&i) => i,
            None => return vec![],
        };

        let mut visited = HashSet::new();
        let mut queue: VecDeque<(NodeIndex, u8)> = VecDeque::new();
        let mut steps = Vec::new();

        queue.push_back((start_idx, 0));
        visited.insert(start_idx);

        while let Some((node, depth)) = queue.pop_front() {
            if depth >= max_depth { continue; }
            for edge in self.graph.edges_directed(node, Direction::Outgoing) {
                let callee_idx = edge.target();
                if visited.contains(&callee_idx) { continue; }
                visited.insert(callee_idx);
                let callee_id = self.graph[callee_idx].clone();
                steps.push(FlowStep {
                    symbol: SymbolRef {
                        id:        callee_id.clone(),
                        name:      String::new(), // filled by service layer
                        kind:      String::new(),
                        file:      edge.weight().call_site_file.clone(),
                        line:      edge.weight().call_site_line,
                        container: None,
                    },
                    via_file: edge.weight().call_site_file.clone(),
                    via_line: edge.weight().call_site_line,
                });
                queue.push_back((callee_idx, depth + 1));
            }
        }
        steps
    }

    /// BFS upstream (all transitive callers) — used for impact analysis.
    /// Returns count only (not all refs, to avoid huge allocations).
    pub fn count_transitive_callers(&self, symbol_id: &str) -> usize {
        let start_idx = match self.id_to_node.get(symbol_id) {
            Some(&i) => i,
            None => return 0,
        };

        let mut visited = HashSet::new();
        let mut queue: VecDeque<NodeIndex> = VecDeque::new();
        queue.push_back(start_idx);
        visited.insert(start_idx);

        while let Some(node) = queue.pop_front() {
            for edge in self.graph.edges_directed(node, Direction::Incoming) {
                let caller_idx = edge.source();
                if !visited.contains(&caller_idx) {
                    visited.insert(caller_idx);
                    queue.push_back(caller_idx);
                }
            }
        }
        // subtract 1 for the start node itself
        visited.len().saturating_sub(1)
    }

    pub fn node_count(&self) -> usize { self.graph.node_count() }
    pub fn edge_count(&self) -> usize { self.graph.edge_count() }
}

impl Default for MemoryCallGraph {
    fn default() -> Self { Self::new() }
}

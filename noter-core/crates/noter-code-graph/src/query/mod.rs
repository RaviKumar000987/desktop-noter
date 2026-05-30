/// Layer 5 — Query Engine.
/// All read-only operations on CodeGraphData. Borrows immutably.
///
/// Queries:
///   find_callers        → who imports this file / who references this symbol
///   find_callees        → what this file imports / what this symbol uses
///   find_references     → all nodes that reference this symbol (by name)
///   find_path           → shortest import path A→B (BFS)
///   find_impact         → all files affected if this file/symbol changed (DFS upstream)
///   find_unused         → exported symbols with no incoming edges
///   find_cycles         → Tarjan SCC on import graph
use std::collections::{HashMap, HashSet, VecDeque};
use petgraph::algo;

use crate::graph::{CodeGraphData, NodeId};
use crate::models::{DependencyCycle, EdgeKind, GraphNode, ImpactResult, UnusedSymbol};

pub struct QueryEngine<'a> {
    data: &'a CodeGraphData,
}

impl<'a> QueryEngine<'a> {
    pub fn new(data: &'a CodeGraphData) -> Self { Self { data } }

    // ── Who imports / depends on this node ────────────────────────────────────

    /// Files that directly import this file / nodes that directly reference this symbol
    pub fn direct_importers(&self, id: NodeId) -> Vec<NodeId> {
        self.data.predecessors(id).collect()
    }

    /// All nodes that call/import this node (direct only, respecting edge kind)
    pub fn find_callers(&self, id: NodeId) -> Vec<NodeId> {
        self.data.edges_to_of_kind(id, EdgeKind::Imports)
            .into_iter()
            .chain(self.data.edges_to_of_kind(id, EdgeKind::Calls))
            .chain(self.data.edges_to_of_kind(id, EdgeKind::References))
            .collect()
    }

    /// All nodes this node depends on
    pub fn find_callees(&self, id: NodeId) -> Vec<NodeId> {
        self.data.edges_of_kind(id, EdgeKind::Imports)
            .into_iter()
            .chain(self.data.edges_of_kind(id, EdgeKind::Calls))
            .chain(self.data.edges_of_kind(id, EdgeKind::References))
            .collect()
    }

    /// Everything this file directly imports
    pub fn file_imports(&self, file: &str) -> Vec<NodeId> {
        if let Some(file_id) = self.data.file_node_of(file) {
            self.data.edges_of_kind(file_id, EdgeKind::Imports)
        } else {
            vec![]
        }
    }

    /// Everything that directly imports this file
    pub fn file_importers(&self, file: &str) -> Vec<NodeId> {
        if let Some(file_id) = self.data.file_node_of(file) {
            self.data.edges_to_of_kind(file_id, EdgeKind::Imports)
        } else {
            vec![]
        }
    }

    // ── Shortest path between two nodes (BFS) ─────────────────────────────────

    pub fn find_path(&self, from_file: &str, to_file: &str) -> Option<Vec<String>> {
        let from = self.data.file_node_of(from_file)?;
        let to   = self.data.file_node_of(to_file)?;

        // BFS over import edges
        let mut visited = HashSet::new();
        let mut queue: VecDeque<(NodeId, Vec<NodeId>)> = VecDeque::new();
        queue.push_back((from, vec![from]));
        visited.insert(from);

        while let Some((current, path)) = queue.pop_front() {
            if current == to {
                return Some(
                    path.iter()
                        .filter_map(|&id| self.data.node(id).map(|n| n.file.clone()))
                        .collect(),
                );
            }
            for next in self.data.edges_of_kind(current, EdgeKind::Imports) {
                if visited.insert(next) {
                    let mut new_path = path.clone();
                    new_path.push(next);
                    queue.push_back((next, new_path));
                }
            }
        }
        None
    }

    // ── Layer 6: Impact Analysis ───────────────────────────────────────────────

    /// Which files would break if `file` were deleted/renamed?
    /// BFS upstream through Imports edges (who imports me, transitively).
    pub fn analyze_impact(&self, file: &str) -> ImpactResult {
        let target_id = match self.data.file_node_of(file) {
            Some(id) => id,
            None => return ImpactResult {
                target_name: file.to_string(),
                target_file: file.to_string(),
                affected_files: vec![],
                affected_symbols: vec![],
                affected_file_count: 0,
                affected_symbol_count: 0,
                max_depth: 0,
            },
        };

        let target_node = self.data.node(target_id).cloned().unwrap_or_else(|| {
            crate::models::GraphNode { name: file.to_string(), kind: crate::models::NodeKind::File,
                file: file.to_string(), line: 0, is_exported: false, language: String::new() }
        });

        // BFS upstream: collect files that (transitively) import target
        let mut visited: HashSet<NodeId> = HashSet::new();
        let mut queue: VecDeque<(NodeId, usize)> = VecDeque::new();
        let mut affected_files: Vec<String> = Vec::new();
        let mut affected_symbols: Vec<String> = Vec::new();
        let mut max_depth = 0usize;

        visited.insert(target_id);
        queue.push_back((target_id, 0));

        while let Some((id, depth)) = queue.pop_front() {
            max_depth = max_depth.max(depth);

            for importer_id in self.data.edges_to_of_kind(id, EdgeKind::Imports) {
                if visited.insert(importer_id) {
                    if let Some(node) = self.data.node(importer_id) {
                        if node.kind == crate::models::NodeKind::File {
                            affected_files.push(node.file.clone());
                        } else {
                            affected_symbols.push(node.name.clone());
                        }
                    }
                    queue.push_back((importer_id, depth + 1));
                }
            }
        }

        let afc = affected_files.len();
        let asc = affected_symbols.len();

        ImpactResult {
            target_name: target_node.name,
            target_file: file.to_string(),
            affected_files,
            affected_symbols,
            affected_file_count: afc,
            affected_symbol_count: asc,
            max_depth,
        }
    }

    // ── Layer 7: Dead Code ─────────────────────────────────────────────────────

    /// Exported symbols with zero incoming References/Imports edges.
    /// These are "dead code candidates" — may be unused.
    pub fn find_unused_exports(&self) -> Vec<UnusedSymbol> {
        self.data.all_nodes()
            .filter(|(_, n)| {
                n.is_exported && n.kind != crate::models::NodeKind::File
            })
            .filter(|&(id, _)| {
                // No incoming edges of any kind (nobody imports/references this symbol)
                self.data.predecessors(id).next().is_none()
            })
            .map(|(_, n)| UnusedSymbol {
                name: n.name.clone(),
                file: n.file.clone(),
                line: n.line,
                kind: n.kind.to_string(),
            })
            .collect()
    }

    /// Files that are never imported by any other file and are not entry points.
    pub fn find_unreachable_files(&self, entry_patterns: &[&str]) -> Vec<String> {
        self.data.all_file_nodes()
            .filter(|(id, n)| {
                let is_entry = entry_patterns.iter().any(|p| n.file.contains(p));
                if is_entry { return false; }
                // No incoming Import edges
                self.data.edges_to_of_kind(*id, EdgeKind::Imports).is_empty()
            })
            .map(|(_, n)| n.file.clone())
            .collect()
    }

    // ── Layer 8: Circular Dependency Detection ────────────────────────────────

    /// Find all import cycles using Tarjan's SCC algorithm.
    /// Any SCC with more than one node is a cycle.
    pub fn find_cycles(&self) -> Vec<DependencyCycle> {
        // Build a view of the graph with only File nodes + Import edges
        let import_only: Vec<_> = self.data.all_file_nodes()
            .map(|(id, _)| id)
            .collect();

        // petgraph tarjan_scc returns SCCs in reverse topological order
        let sccs = algo::tarjan_scc(&self.data.graph);

        sccs.into_iter()
            .filter(|scc| {
                scc.len() > 1 && scc.iter().all(|id| {
                    // Only file nodes
                    self.data.node(*id).map(|n| n.kind == crate::models::NodeKind::File).unwrap_or(false)
                })
            })
            .map(|scc| DependencyCycle {
                files: scc.iter()
                    .filter_map(|id| self.data.node(*id).map(|n| n.file.clone()))
                    .collect(),
            })
            .collect()
    }
}

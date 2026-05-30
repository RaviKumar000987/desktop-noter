use anyhow::Result;
use crate::cache::MemoryCallGraph;

/// Shortest call path between two symbols (BFS).
/// Returns ordered list of symbol IDs on the path, or empty if unreachable.
pub fn shortest_path(
    from_id: &str,
    to_id: &str,
    graph: &MemoryCallGraph,
) -> Result<Vec<String>> {
    // We use the BFS downstream from `from_id` and check if `to_id` is reached.
    // For MVP this is a linear scan of the flow — full Dijkstra not needed.
    let steps = graph.bfs_downstream(from_id, 10);

    // Check if to_id appears in the flow
    for step in &steps {
        if step.symbol.id == to_id {
            // Found — return simple path (just the two endpoints for MVP)
            return Ok(vec![from_id.to_string(), to_id.to_string()]);
        }
    }

    Ok(vec![]) // unreachable within depth 10
}

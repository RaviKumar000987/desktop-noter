use anyhow::Result;
use rusqlite::{Connection, params};
use crate::models::{FlowPath, FlowStep, SymbolRef};
use crate::cache::MemoryCallGraph;

/// Trace execution flow starting from `start_id` up to `max_depth` hops.
/// Returns ordered list of FlowSteps with symbol metadata resolved from SymbolDB.
pub fn trace_flow(
    start_id: &str,
    max_depth: u8,
    graph: &MemoryCallGraph,
    symbol_db_path: &str,
) -> Result<FlowPath> {
    let raw_steps = graph.bfs_downstream(start_id, max_depth);
    let reached_limit = raw_steps.len() >= max_depth as usize;

    let conn = Connection::open(symbol_db_path)?;
    let mut steps = Vec::new();

    for raw in raw_steps {
        // Resolve symbol metadata from SymbolDB
        let mut stmt = conn.prepare(
            "SELECT id, name, kind, file, line, container FROM symbols WHERE id = ?1 LIMIT 1"
        )?;
        let resolved: rusqlite::Result<SymbolRef> = stmt.query_row(
            params![raw.symbol.id],
            |row| Ok(SymbolRef {
                id:        row.get(0)?,
                name:      row.get(1)?,
                kind:      row.get(2)?,
                file:      row.get(3)?,
                line:      row.get::<_, u32>(4)?,
                container: row.get(5)?,
            }),
        );

        let symbol = match resolved {
            Ok(s) => s,
            // If not in SymbolDB, use the partial data from BFS
            Err(_) => SymbolRef {
                id:        raw.symbol.id,
                name:      raw.via_file.clone(),
                kind:      "unknown".into(),
                file:      raw.via_file.clone(),
                line:      raw.via_line,
                container: None,
            },
        };

        steps.push(FlowStep {
            symbol,
            via_file: raw.via_file,
            via_line: raw.via_line,
        });
    }

    Ok(FlowPath {
        total_hops:        steps.len(),
        max_depth_reached: reached_limit,
        steps,
    })
}

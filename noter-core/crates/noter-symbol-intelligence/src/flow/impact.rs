use anyhow::Result;
use rusqlite::{Connection, params};
use crate::models::{ImpactReport, SymbolRef};
use crate::cache::MemoryCallGraph;

/// Compute impact of removing/changing `symbol_id`.
/// Returns direct callers (with metadata) and transitive caller count.
pub fn get_impact(
    symbol_id: &str,
    graph: &MemoryCallGraph,
    symbol_db_path: &str,
) -> Result<ImpactReport> {
    let direct_edges = graph.get_callers(symbol_id);
    let transitive_count = graph.count_transitive_callers(symbol_id);

    let conn = Connection::open(symbol_db_path)?;
    let mut direct_callers = Vec::new();

    for edge in &direct_edges {
        let mut stmt = conn.prepare(
            "SELECT id, name, kind, file, line, container FROM symbols WHERE id = ?1 LIMIT 1"
        )?;
        let result: rusqlite::Result<SymbolRef> = stmt.query_row(
            params![edge.caller_id],
            |row| Ok(SymbolRef {
                id:        row.get(0)?,
                name:      row.get(1)?,
                kind:      row.get(2)?,
                file:      row.get(3)?,
                line:      row.get::<_, u32>(4)?,
                container: row.get(5)?,
            }),
        );
        if let Ok(sym) = result { direct_callers.push(sym); }
    }

    // Get symbol name for the report
    let mut stmt = conn.prepare("SELECT name FROM symbols WHERE id = ?1 LIMIT 1")?;
    let symbol_name: String = stmt
        .query_row(params![symbol_id], |r| r.get(0))
        .unwrap_or_else(|_| symbol_id.to_string());

    Ok(ImpactReport {
        symbol_id: symbol_id.to_string(),
        symbol_name,
        direct_callers,
        transitive_count,
    })
}

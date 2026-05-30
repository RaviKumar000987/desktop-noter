use anyhow::Result;
use rusqlite::{Connection, params};
use crate::models::SymbolRef;
use crate::cache::MemoryCallGraph;

/// Find all direct callers of `symbol_id` using the RAM graph (fast path).
/// Falls back to SQLite if RAM graph is empty (first call, cold start).
pub fn find_callers(
    symbol_id: &str,
    graph: &MemoryCallGraph,
    symbol_db_path: &str,
) -> Result<Vec<SymbolRef>> {
    let raw_edges = graph.get_callers(symbol_id);

    if raw_edges.is_empty() {
        return Ok(vec![]);
    }

    // Resolve caller IDs to full SymbolRef via SymbolDB
    let conn = Connection::open(symbol_db_path)?;
    let mut refs = Vec::new();

    for edge in raw_edges {
        let caller_id = &edge.caller_id;
        let mut stmt = conn.prepare(
            "SELECT id, name, kind, file, line, container FROM symbols WHERE id = ?1 LIMIT 1"
        )?;
        let result: rusqlite::Result<SymbolRef> = stmt.query_row(params![caller_id], |row| {
            Ok(SymbolRef {
                id:        row.get(0)?,
                name:      row.get(1)?,
                kind:      row.get(2)?,
                file:      row.get(3)?,
                line:      row.get::<_, u32>(4)?,
                container: row.get(5)?,
            })
        });
        if let Ok(sym) = result { refs.push(sym); }
    }

    // Deduplicate by id
    refs.sort_by(|a, b| a.id.cmp(&b.id));
    refs.dedup_by_key(|r| r.id.clone());
    Ok(refs)
}

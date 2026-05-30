use anyhow::Result;
use rusqlite::{Connection, params};
use crate::models::SymbolRef;
use crate::cache::MemoryCallGraph;

/// Find all direct callees of `symbol_id` using the RAM graph.
pub fn find_callees(
    symbol_id: &str,
    graph: &MemoryCallGraph,
    symbol_db_path: &str,
) -> Result<Vec<SymbolRef>> {
    let raw_edges = graph.get_callees(symbol_id);

    if raw_edges.is_empty() {
        return Ok(vec![]);
    }

    let conn = Connection::open(symbol_db_path)?;
    let mut refs = Vec::new();

    for edge in raw_edges {
        let callee_id = match &edge.callee_id {
            Some(id) => id.clone(),
            None => continue, // unresolved edge — skip
        };
        let mut stmt = conn.prepare(
            "SELECT id, name, kind, file, line, container FROM symbols WHERE id = ?1 LIMIT 1"
        )?;
        let result: rusqlite::Result<SymbolRef> = stmt.query_row(params![callee_id], |row| {
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

    refs.sort_by(|a, b| a.id.cmp(&b.id));
    refs.dedup_by_key(|r| r.id.clone());
    Ok(refs)
}

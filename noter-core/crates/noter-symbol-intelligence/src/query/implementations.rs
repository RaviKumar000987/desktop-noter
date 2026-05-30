use anyhow::Result;
use rusqlite::{Connection, params};
use crate::models::SymbolRef;

/// Find implementations of an interface or abstract class.
/// Queries SymbolDB for symbols whose `container` or `implements` matches.
pub fn find_implementations(
    interface_name: &str,
    symbol_db_path: &str,
) -> Result<Vec<SymbolRef>> {
    let conn = Connection::open(symbol_db_path)?;

    // Look for classes/functions that implement the interface.
    // SymbolDB container field stores "implements InterfaceName" or class name.
    let mut stmt = conn.prepare(
        "SELECT id, name, kind, file, line, container FROM symbols
         WHERE container LIKE ?1 AND kind IN ('class','function','method')
         LIMIT 50"
    )?;

    let pattern = format!("%{}%", interface_name);
    let refs: Vec<SymbolRef> = stmt
        .query_map(params![pattern], |row| {
            Ok(SymbolRef {
                id:        row.get(0)?,
                name:      row.get(1)?,
                kind:      row.get(2)?,
                file:      row.get(3)?,
                line:      row.get::<_, u32>(4)?,
                container: row.get(5)?,
            })
        })?
        .flatten()
        .collect();

    Ok(refs)
}

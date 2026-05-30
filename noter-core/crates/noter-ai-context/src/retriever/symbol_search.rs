/// Search SymbolDB for symbols relevant to query keywords.
use anyhow::Result;
use rusqlite::{Connection, params};
use crate::models::ContextSymbol;

/// Find symbols whose name, file, or container match any keyword.
/// Returns deduplicated candidates sorted by match quality.
pub fn search(
    keywords: &[String],
    symbol_db_path: &str,
    limit: usize,
) -> Result<Vec<ContextSymbol>> {
    let conn = match Connection::open(symbol_db_path) {
        Ok(c) => c,
        Err(_) => return Ok(vec![]),
    };

    // Check if symbols table exists
    let table_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='symbols'",
            [],
            |r| r.get::<_, i64>(0),
        )
        .map(|n| n > 0)
        .unwrap_or(false);

    if !table_exists { return Ok(vec![]); }

    let mut all: Vec<ContextSymbol> = Vec::new();
    let mut seen_ids = std::collections::HashSet::new();

    for kw in keywords {
        let pattern = format!("%{}%", kw);
        let mut stmt = conn.prepare(
            "SELECT id, name, kind, file, line, container FROM symbols
             WHERE (name LIKE ?1 OR file LIKE ?1 OR container LIKE ?1)
               AND file NOT LIKE '%node_modules%'
               AND file NOT LIKE '%.test.%'
               AND file NOT LIKE '%.spec.%'
               AND file NOT LIKE '%/test/%'
               AND kind IN ('function','method','class','interface','constructor','arrow')
             ORDER BY
               CASE WHEN name LIKE ?2 THEN 0 ELSE 1 END,
               CASE WHEN kind IN ('function','method') THEN 0 ELSE 1 END
             LIMIT ?3"
        )?;

        let exact_pattern = format!("{}%", kw);
        let results: Vec<ContextSymbol> = stmt
            .query_map(params![pattern, exact_pattern, limit as i64], |row| {
                Ok(ContextSymbol {
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

        for sym in results {
            if seen_ids.insert(sym.id.clone()) {
                all.push(sym);
            }
        }
    }

    Ok(all)
}

/// Get all symbols from a specific file (for file-anchored context).
pub fn symbols_in_file(file: &str, symbol_db_path: &str) -> Result<Vec<ContextSymbol>> {
    let conn = match Connection::open(symbol_db_path) {
        Ok(c) => c,
        Err(_) => return Ok(vec![]),
    };

    let mut stmt = match conn.prepare(
        "SELECT id, name, kind, file, line, container FROM symbols WHERE file = ?1 LIMIT 50"
    ) {
        Ok(s) => s,
        Err(_) => return Ok(vec![]),
    };

    let syms: Vec<ContextSymbol> = stmt
        .query_map(params![file], |row| {
            Ok(ContextSymbol {
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

    Ok(syms)
}

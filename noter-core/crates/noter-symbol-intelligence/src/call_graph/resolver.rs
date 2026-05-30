/// Resolver: callee_name (raw string) → SymbolId (UUID from SymbolDB).
///
/// Strategy:
///   1. Strip object prefix: "obj.method" → "method"
///   2. Exact name match in SymbolDB (same workspace)
///   3. If multiple matches, prefer same file, then same directory
///   4. If still ambiguous, take first — mark confidence 70
use anyhow::Result;
use rusqlite::{Connection, params};

#[derive(Debug, Clone)]
pub struct ResolvedSymbol {
    pub id:         String,
    pub name:       String,
    pub file:       String,
    pub confidence: u8,
}

/// Resolve a raw callee name to a SymbolId.
/// `caller_file` is used for proximity preference.
pub fn resolve(
    callee_name: &str,
    caller_file: &str,
    symbol_db_path: &str,
) -> Result<Option<ResolvedSymbol>> {
    let conn = Connection::open(symbol_db_path)?;

    // Strip method prefix: "this.authenticate" → "authenticate"
    // Strip "new " prefix: "new UserService" → "UserService"
    let bare_name = callee_name
        .trim_start_matches("new ")
        .rsplit('.')
        .next()
        .unwrap_or(callee_name)
        .trim();

    if bare_name.is_empty() { return Ok(None); }

    // Query SymbolDB for candidates — prefer function/method kinds.
    // Return Ok(None) gracefully if the SymbolDB hasn't been built yet.
    let mut stmt = match conn.prepare(
        "SELECT id, name, file FROM symbols
         WHERE name = ?1 AND kind IN ('function','method','constructor','arrow')
         ORDER BY CASE WHEN file = ?2 THEN 0 ELSE 1 END, file"
    ) {
        Ok(s) => s,
        Err(_) => return Ok(None), // table doesn't exist yet — workspace not indexed
    };

    let results: Vec<ResolvedSymbol> = stmt.query_map(params![bare_name, caller_file], |row| {
        Ok(ResolvedSymbol {
            id:         row.get(0)?,
            name:       row.get(1)?,
            file:       row.get(2)?,
            confidence: 100,
        })
    })?.flatten().collect();

    match results.len() {
        0 => Ok(None),
        1 => Ok(Some(results.into_iter().next().unwrap())),
        _ => {
            // Multiple matches — prefer same file, then same directory
            let same_file = results.iter().find(|r| r.file == caller_file);
            if let Some(r) = same_file { return Ok(Some(r.clone())); }

            let caller_dir = std::path::Path::new(caller_file)
                .parent()
                .and_then(|p| p.to_str())
                .unwrap_or("");
            let same_dir = results.iter().find(|r| r.file.starts_with(caller_dir));
            if let Some(r) = same_dir {
                return Ok(Some(ResolvedSymbol { confidence: 85, ..r.clone() }));
            }

            // Ambiguous — take first, mark confidence 70
            let mut r = results.into_iter().next().unwrap();
            r.confidence = 70;
            Ok(Some(r))
        }
    }
}

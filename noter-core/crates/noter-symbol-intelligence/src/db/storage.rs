use anyhow::Result;
use rusqlite::{Connection, params};
use std::time::{SystemTime, UNIX_EPOCH};
use crate::models::CallEdge;
use super::schema::CREATE_CALL_EDGES;

/// Open (or create) the call-edges SQLite database and ensure schema exists.
pub fn open(db_path: &str) -> Result<Connection> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch(CREATE_CALL_EDGES)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")?;
    Ok(conn)
}

/// Persist a batch of CallEdges to SQLite (called from background thread).
pub fn persist(edges: &[CallEdge], workspace_root: &str, db_path: &str) -> Result<usize> {
    let conn = open(db_path)?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    let mut inserted = 0usize;
    for e in edges {
        // edge id = deterministic from caller+callee+file+line
        let id = format!("{}-{}-{}:{}", e.caller_id, e.callee_name, e.call_site_file, e.call_site_line);
        conn.execute(
            "INSERT OR REPLACE INTO call_edges
             (id, caller_id, callee_name, callee_id, call_site_file, call_site_line, call_site_col,
              is_async, confidence, workspace_root, indexed_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
            params![
                id,
                e.caller_id,
                e.callee_name,
                e.callee_id,
                e.call_site_file,
                e.call_site_line,
                e.call_site_col,
                e.is_async as i32,
                e.confidence,
                workspace_root,
                now,
            ],
        )?;
        inserted += 1;
    }
    Ok(inserted)
}

/// Load all call edges for a workspace root from SQLite (startup hydration).
pub fn load(workspace_root: &str, db_path: &str) -> Result<Vec<CallEdge>> {
    let conn = open(db_path)?;
    let mut stmt = conn.prepare(
        "SELECT caller_id, callee_name, callee_id, call_site_file, call_site_line,
                call_site_col, is_async, confidence
         FROM call_edges WHERE workspace_root = ?1"
    )?;
    let rows = stmt.query_map(params![workspace_root], |row| {
        Ok(CallEdge {
            caller_id:      row.get(0)?,
            callee_name:    row.get(1)?,
            callee_id:      row.get(2)?,
            call_site_file: row.get(3)?,
            call_site_line: row.get(4)?,
            call_site_col:  row.get(5)?,
            is_async:       row.get::<_, i32>(6)? != 0,
            confidence:     row.get::<_, u8>(7)?,
        })
    })?;

    let mut edges = Vec::new();
    for row in rows { edges.push(row?); }
    Ok(edges)
}

/// Delete all call edges for a specific file (used during incremental re-index).
pub fn delete_file_edges(file_path: &str, workspace_root: &str, db_path: &str) -> Result<usize> {
    let conn = open(db_path)?;
    let deleted = conn.execute(
        "DELETE FROM call_edges WHERE call_site_file = ?1 AND workspace_root = ?2",
        params![file_path, workspace_root],
    )?;
    Ok(deleted)
}

pub const CREATE_CALL_EDGES: &str = "
CREATE TABLE IF NOT EXISTS call_edges (
    id              TEXT PRIMARY KEY,
    caller_id       TEXT NOT NULL,
    callee_name     TEXT NOT NULL,
    callee_id       TEXT,
    call_site_file  TEXT NOT NULL,
    call_site_line  INTEGER NOT NULL,
    call_site_col   INTEGER NOT NULL,
    is_async        INTEGER NOT NULL DEFAULT 0,
    confidence      INTEGER NOT NULL DEFAULT 100,
    workspace_root  TEXT NOT NULL,
    indexed_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ce_caller    ON call_edges(caller_id);
CREATE INDEX IF NOT EXISTS idx_ce_callee    ON call_edges(callee_id);
CREATE INDEX IF NOT EXISTS idx_ce_workspace ON call_edges(workspace_root);
CREATE INDEX IF NOT EXISTS idx_ce_file      ON call_edges(call_site_file);
";

use std::time::{SystemTime, UNIX_EPOCH};
use anyhow::Result;
use rusqlite::{Connection, params};

use crate::{
    models::*,
    naming::detect_naming_convention,
};

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub struct MemoryService {
    conn: Connection,
}

impl MemoryService {
    pub fn open(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")?;
        Self::migrate(&conn)?;
        Ok(Self { conn })
    }

    fn migrate(conn: &Connection) -> Result<()> {
        conn.execute_batch("
            CREATE TABLE IF NOT EXISTS sessions (
                workspace     TEXT PRIMARY KEY,
                session_count INTEGER NOT NULL DEFAULT 1,
                last_file     TEXT,
                last_active   INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS file_history (
                workspace   TEXT NOT NULL,
                path        TEXT NOT NULL,
                opens       INTEGER NOT NULL DEFAULT 1,
                last_opened INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (workspace, path)
            );
            CREATE TABLE IF NOT EXISTS ai_queries (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                workspace TEXT NOT NULL,
                query     TEXT NOT NULL,
                at        INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS patterns (
                workspace    TEXT PRIMARY KEY,
                naming       TEXT,
                framework    TEXT,
                architecture TEXT,
                language     TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_file_history_ws   ON file_history(workspace);
            CREATE INDEX IF NOT EXISTS idx_ai_queries_ws     ON ai_queries(workspace, at DESC);
        ")?;
        Ok(())
    }

    // ── Session ───────────────────────────────────────────────────

    pub fn bump_session(&self, workspace: &str) -> Result<SessionInfo> {
        let now = now_ms();
        self.conn.execute(
            "INSERT INTO sessions(workspace, session_count, last_active)
             VALUES(?1, 1, ?2)
             ON CONFLICT(workspace) DO UPDATE SET
               session_count = session_count + 1,
               last_active   = ?2",
            params![workspace, now as i64],
        )?;
        self.get_session(workspace)
    }

    pub fn get_session(&self, workspace: &str) -> Result<SessionInfo> {
        let mut stmt = self.conn.prepare(
            "SELECT session_count, last_file, last_active FROM sessions WHERE workspace = ?1"
        )?;
        let row = stmt.query_row(params![workspace], |r| {
            Ok(SessionInfo {
                workspace:     workspace.to_string(),
                session_count: r.get::<_, i64>(0)? as u32,
                last_file:     r.get(1)?,
                last_active:   r.get::<_, i64>(2)? as u64,
            })
        }).unwrap_or_else(|_| SessionInfo {
            workspace: workspace.to_string(), session_count: 0, last_file: None, last_active: 0,
        });
        Ok(row)
    }

    // ── File History ──────────────────────────────────────────────

    pub fn record_file_open(&self, workspace: &str, file_path: &str) -> Result<()> {
        let now = now_ms();
        self.conn.execute(
            "INSERT INTO file_history(workspace, path, opens, last_opened)
             VALUES(?1, ?2, 1, ?3)
             ON CONFLICT(workspace, path) DO UPDATE SET
               opens       = opens + 1,
               last_opened = ?3",
            params![workspace, file_path, now as i64],
        )?;
        self.conn.execute(
            "UPDATE sessions SET last_file = ?1, last_active = ?2 WHERE workspace = ?3",
            params![file_path, now as i64, workspace],
        )?;
        Ok(())
    }

    pub fn get_file_history(&self, workspace: &str, limit: usize) -> Result<Vec<FileRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT path, opens, last_opened FROM file_history
             WHERE workspace = ?1
             ORDER BY last_opened DESC
             LIMIT ?2"
        )?;
        let rows = stmt.query_map(params![workspace, limit as i64], |r| {
            Ok(FileRecord {
                path:        r.get(0)?,
                opens:       r.get::<_, i64>(1)? as u32,
                last_opened: r.get::<_, i64>(2)? as u64,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();
        Ok(rows)
    }

    // ── AI Queries ────────────────────────────────────────────────

    pub fn record_ai_query(&self, workspace: &str, query: &str) -> Result<()> {
        let now = now_ms();
        // Keep only last 30 per workspace
        self.conn.execute(
            "DELETE FROM ai_queries WHERE workspace = ?1
             AND id NOT IN (
               SELECT id FROM ai_queries WHERE workspace = ?1
               ORDER BY at DESC LIMIT 29
             )",
            params![workspace],
        )?;
        self.conn.execute(
            "INSERT INTO ai_queries(workspace, query, at) VALUES(?1, ?2, ?3)",
            params![workspace, &query[..query.len().min(120)], now as i64],
        )?;
        Ok(())
    }

    pub fn get_ai_queries(&self, workspace: &str, limit: usize) -> Result<Vec<QueryRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT query, at FROM ai_queries
             WHERE workspace = ?1
             ORDER BY at DESC
             LIMIT ?2"
        )?;
        let rows = stmt.query_map(params![workspace, limit as i64], |r| {
            Ok(QueryRecord {
                query: r.get(0)?,
                at:    r.get::<_, i64>(1)? as u64,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();
        Ok(rows)
    }

    // ── Patterns ──────────────────────────────────────────────────

    pub fn get_patterns(&self, workspace: &str) -> Result<WorkspacePatterns> {
        let mut stmt = self.conn.prepare(
            "SELECT naming, framework, architecture, language FROM patterns WHERE workspace = ?1"
        )?;
        let p = stmt.query_row(params![workspace], |r| {
            Ok(WorkspacePatterns {
                naming:       r.get(0)?,
                framework:    r.get(1)?,
                architecture: r.get(2)?,
                language:     r.get(3)?,
            })
        }).unwrap_or_default();
        Ok(p)
    }

    pub fn update_patterns(&self, workspace: &str, patterns: &WorkspacePatterns) -> Result<()> {
        self.conn.execute(
            "INSERT INTO patterns(workspace, naming, framework, architecture, language)
             VALUES(?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(workspace) DO UPDATE SET
               naming       = COALESCE(?2, naming),
               framework    = COALESCE(?3, framework),
               architecture = COALESCE(?4, architecture),
               language     = COALESCE(?5, language)",
            params![
                workspace,
                patterns.naming.as_deref(),
                patterns.framework.as_deref(),
                patterns.architecture.as_deref(),
                patterns.language.as_deref(),
            ],
        )?;
        Ok(())
    }

    pub fn detect_and_save_naming(&self, workspace: &str) -> Result<Option<String>> {
        let files: Vec<String> = self.get_file_history(workspace, 30)?
            .into_iter().map(|f| f.path).collect();
        let naming = detect_naming_convention(&files);
        if let Some(ref n) = naming {
            let p = WorkspacePatterns { naming: Some(n.clone()), ..Default::default() };
            self.update_patterns(workspace, &p)?;
        }
        Ok(naming)
    }

    // ── Context (for AI prompt enrichment) ───────────────────────

    pub fn get_context(&self, workspace: &str) -> Result<MemoryContext> {
        let files   = self.get_file_history(workspace, 5)?;
        let queries = self.get_ai_queries(workspace, 3)?;
        let pat     = self.get_patterns(workspace)?;
        Ok(MemoryContext {
            recent_files:      files.into_iter().map(|f| f.path).collect(),
            recent_queries:    queries.into_iter().map(|q| q.query).collect(),
            naming_convention: pat.naming,
            framework:         pat.framework,
            architecture:      pat.architecture,
            language:          pat.language,
        })
    }

    // ── Insights ──────────────────────────────────────────────────

    pub fn get_insights(&self, workspace: &str) -> Result<Vec<WorkspaceInsight>> {
        let session = self.get_session(workspace)?;
        let files   = self.get_file_history(workspace, 60)?;
        let queries = self.get_ai_queries(workspace, 10)?;
        let mut insights = Vec::new();

        // Most opened file
        if let Some(top) = files.iter().max_by_key(|f| f.opens) {
            let name = top.path.replace('\\', "/")
                .rsplit('/').next().unwrap_or("").to_string();
            insights.push(WorkspaceInsight {
                icon:   "🔥".into(),
                title:  "Most Active File".into(),
                detail: format!("{name} — opened {} time{}", top.opens, if top.opens != 1 { "s" } else { "" }),
            });
        }

        // Current focus area
        let recent5: Vec<_> = files.iter().take(5).map(|f| f.path.to_lowercase()).collect();
        let mut topics = Vec::new();
        if recent5.iter().any(|p| p.contains("auth") || p.contains("login") || p.contains("jwt")) {
            topics.push("Authentication");
        }
        if recent5.iter().any(|p| p.contains("api") || p.contains("route") || p.contains("controller")) {
            topics.push("API Layer");
        }
        if recent5.iter().any(|p| p.contains("db") || p.contains("model") || p.contains("schema")) {
            topics.push("Database");
        }
        if recent5.iter().any(|p| p.contains("component") || p.contains("view") || p.contains("page")) {
            topics.push("UI Layer");
        }
        if recent5.iter().any(|p| p.contains("test") || p.contains("spec")) {
            topics.push("Testing");
        }
        if !topics.is_empty() {
            insights.push(WorkspaceInsight {
                icon:   "🎯".into(),
                title:  "Current Focus".into(),
                detail: topics.join(" · "),
            });
        }

        // Session streak
        if session.session_count >= 3 {
            insights.push(WorkspaceInsight {
                icon:   "⚡".into(),
                title:  format!("{} Sessions on This Project", session.session_count),
                detail: "Memory is getting smarter with each session.".into(),
            });
        }

        // Recent AI focus
        if !queries.is_empty() {
            let sample: Vec<_> = queries.iter().take(3).map(|q| {
                if q.query.len() > 30 { format!("{}…", &q.query[..28]) } else { q.query.clone() }
            }).collect();
            insights.push(WorkspaceInsight {
                icon:   "💬".into(),
                title:  "Recent AI Focus".into(),
                detail: sample.join(", "),
            });
        }

        // Summary
        insights.push(WorkspaceInsight {
            icon:   "📊".into(),
            title:  "Memory Summary".into(),
            detail: format!("{} files · {} AI queries · {} sessions",
                files.len(), queries.len(), session.session_count),
        });

        Ok(insights)
    }

    // ── Clear workspace ───────────────────────────────────────────

    pub fn clear_workspace(&self, workspace: &str) -> Result<()> {
        self.conn.execute("DELETE FROM sessions    WHERE workspace = ?1", params![workspace])?;
        self.conn.execute("DELETE FROM file_history WHERE workspace = ?1", params![workspace])?;
        self.conn.execute("DELETE FROM ai_queries  WHERE workspace = ?1", params![workspace])?;
        self.conn.execute("DELETE FROM patterns    WHERE workspace = ?1", params![workspace])?;
        Ok(())
    }

    pub fn get_welcome_insight(&self, workspace: &str) -> Result<Option<String>> {
        let s = self.get_session(workspace)?;
        if let Some(ref f) = s.last_file {
            let name = f.replace('\\', "/").rsplit('/').next().unwrap_or("").to_string();
            return Ok(Some(format!("Welcome back! You were working on {name}.")));
        }
        Ok(None)
    }
}

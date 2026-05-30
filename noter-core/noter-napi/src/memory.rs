use napi_derive::napi;
use napi::bindgen_prelude::*;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use noter_memory_engine::{MemoryService, WorkspacePatterns};

// ── Singleton: one MemoryService per DB path ──────────────────────────────────

static SERVICES: OnceLock<Mutex<HashMap<String, MemoryService>>> = OnceLock::new();

fn services() -> &'static Mutex<HashMap<String, MemoryService>> {
    SERVICES.get_or_init(|| Mutex::new(HashMap::new()))
}

fn with_service<F, T>(db_path: &str, f: F) -> std::result::Result<T, Error>
where F: FnOnce(&mut MemoryService) -> anyhow::Result<T>
{
    let mut map = services().lock().map_err(|e| Error::from_reason(e.to_string()))?;
    let svc = map.entry(db_path.to_string())
        .or_insert_with(|| MemoryService::open(db_path).expect("memory db open"));
    f(svc).map_err(|e| Error::from_reason(e.to_string()))
}

// ── JS-facing types ───────────────────────────────────────────────────────────

#[napi(object)]
pub struct JsSessionInfo {
    pub workspace:     String,
    pub session_count: u32,
    pub last_file:     Option<String>,
    pub last_active:   f64,   // u64 → f64 (JS number)
}

#[napi(object)]
pub struct JsFileRecord {
    pub path:        String,
    pub opens:       u32,
    pub last_opened: f64,
}

#[napi(object)]
pub struct JsQueryRecord {
    pub query: String,
    pub at:    f64,
}

#[napi(object)]
pub struct JsWorkspacePatterns {
    pub naming:       Option<String>,
    pub framework:    Option<String>,
    pub architecture: Option<String>,
    pub language:     Option<String>,
}

#[napi(object)]
pub struct JsInsight {
    pub icon:   String,
    pub title:  String,
    pub detail: String,
}

#[napi(object)]
pub struct JsMemoryContext {
    pub recent_files:      Vec<String>,
    pub recent_queries:    Vec<String>,
    pub naming_convention: Option<String>,
    pub framework:         Option<String>,
    pub architecture:      Option<String>,
    pub language:          Option<String>,
}

// ── NAPI functions ────────────────────────────────────────────────────────────

/// Increment session count and return session info.
#[napi]
pub fn memory_bump_session(db_path: String, workspace: String) -> Result<JsSessionInfo> {
    with_service(&db_path, |svc| {
        let s = svc.bump_session(&workspace)?;
        Ok(JsSessionInfo {
            workspace:     s.workspace,
            session_count: s.session_count,
            last_file:     s.last_file,
            last_active:   s.last_active as f64,
        })
    })
}

/// Get session info without bumping.
#[napi]
pub fn memory_get_session(db_path: String, workspace: String) -> Result<JsSessionInfo> {
    with_service(&db_path, |svc| {
        let s = svc.get_session(&workspace)?;
        Ok(JsSessionInfo {
            workspace:     s.workspace,
            session_count: s.session_count,
            last_file:     s.last_file,
            last_active:   s.last_active as f64,
        })
    })
}

/// Record a file open event.
#[napi]
pub fn memory_record_file_open(db_path: String, workspace: String, file_path: String) -> Result<()> {
    with_service(&db_path, |svc| svc.record_file_open(&workspace, &file_path))
}

/// Get file history (sorted by last opened, most recent first).
#[napi]
pub fn memory_get_file_history(db_path: String, workspace: String, limit: u32) -> Result<Vec<JsFileRecord>> {
    with_service(&db_path, |svc| {
        let rows = svc.get_file_history(&workspace, limit as usize)?;
        Ok(rows.into_iter().map(|r| JsFileRecord {
            path: r.path, opens: r.opens, last_opened: r.last_opened as f64,
        }).collect())
    })
}

/// Record an AI query.
#[napi]
pub fn memory_record_ai_query(db_path: String, workspace: String, query: String) -> Result<()> {
    with_service(&db_path, |svc| svc.record_ai_query(&workspace, &query))
}

/// Get AI query history (most recent first).
#[napi]
pub fn memory_get_ai_queries(db_path: String, workspace: String, limit: u32) -> Result<Vec<JsQueryRecord>> {
    with_service(&db_path, |svc| {
        let rows = svc.get_ai_queries(&workspace, limit as usize)?;
        Ok(rows.into_iter().map(|r| JsQueryRecord {
            query: r.query, at: r.at as f64,
        }).collect())
    })
}

/// Get detected workspace patterns.
#[napi]
pub fn memory_get_patterns(db_path: String, workspace: String) -> Result<JsWorkspacePatterns> {
    with_service(&db_path, |svc| {
        let p = svc.get_patterns(&workspace)?;
        Ok(JsWorkspacePatterns {
            naming: p.naming, framework: p.framework,
            architecture: p.architecture, language: p.language,
        })
    })
}

/// Update workspace patterns (framework, language, architecture from project scan).
#[napi]
pub fn memory_update_patterns(
    db_path:      String,
    workspace:    String,
    naming:       Option<String>,
    framework:    Option<String>,
    architecture: Option<String>,
    language:     Option<String>,
) -> Result<()> {
    with_service(&db_path, |svc| {
        svc.update_patterns(&workspace, &WorkspacePatterns { naming, framework, architecture, language })
    })
}

/// Detect naming convention from file history and save it.
#[napi]
pub fn memory_detect_naming(db_path: String, workspace: String) -> Result<Option<String>> {
    with_service(&db_path, |svc| svc.detect_and_save_naming(&workspace))
}

/// Get context for AI prompt enrichment.
#[napi]
pub fn memory_get_context(db_path: String, workspace: String) -> Result<JsMemoryContext> {
    with_service(&db_path, |svc| {
        let ctx = svc.get_context(&workspace)?;
        Ok(JsMemoryContext {
            recent_files:      ctx.recent_files,
            recent_queries:    ctx.recent_queries,
            naming_convention: ctx.naming_convention,
            framework:         ctx.framework,
            architecture:      ctx.architecture,
            language:          ctx.language,
        })
    })
}

/// Get workspace insights (most active file, focus area, session info).
#[napi]
pub fn memory_get_insights(db_path: String, workspace: String) -> Result<Vec<JsInsight>> {
    with_service(&db_path, |svc| {
        let insights = svc.get_insights(&workspace)?;
        Ok(insights.into_iter().map(|i| JsInsight { icon: i.icon, title: i.title, detail: i.detail }).collect())
    })
}

/// Get welcome-back message ("You were working on X").
#[napi]
pub fn memory_get_welcome(db_path: String, workspace: String) -> Result<Option<String>> {
    with_service(&db_path, |svc| svc.get_welcome_insight(&workspace))
}

/// Clear all memory for a workspace.
#[napi]
pub fn memory_clear_workspace(db_path: String, workspace: String) -> Result<()> {
    with_service(&db_path, |svc| svc.clear_workspace(&workspace))
}

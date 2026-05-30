use napi_derive::napi;
use napi::bindgen_prelude::*;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use noter_ai_context::{
    AiContextService, AiContext, AiPrompt,
    models::{ProjectSummary, RankedSymbol, FileSnippet},
};

// ── Singleton: one service per workspace root ─────────────────────────────────

static AI_SERVICES: OnceLock<Mutex<HashMap<String, AiContextService>>> = OnceLock::new();

fn services() -> &'static Mutex<HashMap<String, AiContextService>> {
    AI_SERVICES.get_or_init(|| Mutex::new(HashMap::new()))
}

fn with_service<F, T>(workspace_root: &str, f: F) -> std::result::Result<T, Error>
where
    F: FnOnce(&mut AiContextService) -> anyhow::Result<T>,
{
    let mut map = services().lock().map_err(|e| Error::from_reason(e.to_string()))?;
    let svc = map
        .entry(workspace_root.to_string())
        .or_insert_with(|| AiContextService::new(workspace_root.to_string()));
    f(svc).map_err(|e| Error::from_reason(e.to_string()))
}

// ── JS-facing types ───────────────────────────────────────────────────────────

#[napi(object)]
pub struct JsProjectSummary {
    pub language:     String,
    pub framework:    Option<String>,
    pub architecture: Option<String>,
    pub database:     Option<String>,
    pub orm:          Option<String>,
    pub auth_system:  Option<String>,
}

#[napi(object)]
pub struct JsContextSymbol {
    pub id:        String,
    pub name:      String,
    pub kind:      String,
    pub file:      String,
    pub line:      u32,
    pub container: Option<String>,
}

#[napi(object)]
pub struct JsRankedSymbol {
    pub symbol: JsContextSymbol,
    pub score:  f64,
    pub reason: String,
}

#[napi(object)]
pub struct JsFileSnippet {
    pub file:        String,
    pub language:    String,
    pub start_line:  u32,
    pub end_line:    u32,
    pub content:     String,
    pub symbol_name: Option<String>,
}

#[napi(object)]
pub struct JsAiContext {
    pub query:           String,
    pub language:        String,
    pub framework:       Option<String>,
    pub architecture:    Option<String>,
    pub database:        Option<String>,
    pub auth_system:     Option<String>,
    pub ranked_symbols:  Vec<JsRankedSymbol>,
    pub file_snippets:   Vec<JsFileSnippet>,
    pub build_time_ms:   u32,
    pub symbol_count:    u32,
    pub token_estimate:  u32,
}

#[napi(object)]
pub struct JsAiPrompt {
    pub system: String,
    pub user:   String,
    pub model:  String,
}

// ── NAPI functions ────────────────────────────────────────────────────────────

/// Build AI context for a natural language query.
/// Returns ranked symbols + file snippets (< 200ms target).
#[napi]
pub fn build_ai_context(
    workspace_root:  String,
    query:           String,
    symbol_db_path:  String,
    project:         JsProjectSummary,
) -> Result<JsAiContext> {
    let proj = ProjectSummary {
        language:     project.language,
        framework:    project.framework,
        architecture: project.architecture,
        database:     project.database,
        orm:          project.orm,
        auth_system:  project.auth_system,
    };

    with_service(&workspace_root, |svc| {
        let ctx = svc.build_context(&query, &symbol_db_path, proj)?;
        Ok(js_context(ctx))
    })
}

/// Build the formatted prompt string from a previously built context.
#[napi]
pub fn build_ai_prompt(
    workspace_root: String,
    query:          String,
    symbol_db_path: String,
    project:        JsProjectSummary,
    model:          String,
) -> Result<JsAiPrompt> {
    let proj = ProjectSummary {
        language:     project.language,
        framework:    project.framework,
        architecture: project.architecture,
        database:     project.database,
        orm:          project.orm,
        auth_system:  project.auth_system,
    };

    with_service(&workspace_root, |svc| {
        let ctx = svc.build_context(&query, &symbol_db_path, proj)?;
        let prompt = svc.build_prompt(&ctx, &model);
        Ok(JsAiPrompt { system: prompt.system, user: prompt.user, model: prompt.model })
    })
}

/// Invalidate context cache (call after file save / workspace change).
#[napi]
pub fn invalidate_ai_context(workspace_root: String) -> Result<()> {
    with_service(&workspace_root, |svc| {
        svc.invalidate_cache();
        Ok(())
    })
}

// ── Converters ────────────────────────────────────────────────────────────────

fn js_context(ctx: AiContext) -> JsAiContext {
    JsAiContext {
        query:          ctx.query,
        language:       ctx.project.language,
        framework:      ctx.project.framework,
        architecture:   ctx.project.architecture,
        database:       ctx.project.database,
        auth_system:    ctx.project.auth_system,
        build_time_ms:  ctx.build_time_ms.min(u32::MAX as u64) as u32,
        symbol_count:   ctx.symbol_count as u32,
        token_estimate: ctx.token_estimate as u32,
        ranked_symbols: ctx.ranked_symbols.into_iter().map(js_ranked).collect(),
        file_snippets:  ctx.file_snippets.into_iter().map(js_snippet).collect(),
    }
}

fn js_ranked(r: RankedSymbol) -> JsRankedSymbol {
    JsRankedSymbol {
        score:  r.score as f64,
        reason: r.reason,
        symbol: JsContextSymbol {
            id:        r.symbol.id,
            name:      r.symbol.name,
            kind:      r.symbol.kind,
            file:      r.symbol.file,
            line:      r.symbol.line,
            container: r.symbol.container,
        },
    }
}

fn js_snippet(s: FileSnippet) -> JsFileSnippet {
    JsFileSnippet {
        file:        s.file,
        language:    s.language,
        start_line:  s.start_line,
        end_line:    s.end_line,
        content:     s.content,
        symbol_name: s.symbol_name,
    }
}

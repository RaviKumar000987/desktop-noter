use napi_derive::napi;
use napi::bindgen_prelude::*;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use noter_symbol_intelligence::{
    SymbolIntelligenceService,
    SymbolRef, FlowStep,
};

// ── Singleton: one service per workspace root ─────────────────────────────────

static SERVICES: OnceLock<Mutex<HashMap<String, SymbolIntelligenceService>>> = OnceLock::new();

fn services() -> &'static Mutex<HashMap<String, SymbolIntelligenceService>> {
    SERVICES.get_or_init(|| Mutex::new(HashMap::new()))
}

fn with_service<F, T>(workspace_root: &str, f: F) -> std::result::Result<T, Error>
where
    F: FnOnce(&mut SymbolIntelligenceService) -> anyhow::Result<T>,
{
    let mut map = services().lock().map_err(|e| Error::from_reason(e.to_string()))?;
    let svc = map
        .entry(workspace_root.to_string())
        .or_insert_with(|| SymbolIntelligenceService::new(workspace_root.to_string()));
    f(svc).map_err(|e| Error::from_reason(e.to_string()))
}

// ── JS-facing types ───────────────────────────────────────────────────────────

#[napi(object)]
pub struct JsSymbolRef {
    pub id:        String,
    pub name:      String,
    pub kind:      String,
    pub file:      String,
    pub line:      u32,
    pub container: Option<String>,
}

#[napi(object)]
pub struct JsFlowStep {
    pub symbol:   JsSymbolRef,
    pub via_file: String,
    pub via_line: u32,
}

#[napi(object)]
pub struct JsFlowPath {
    pub steps:             Vec<JsFlowStep>,
    pub max_depth_reached: bool,
    pub total_hops:        u32,
}

#[napi(object)]
pub struct JsImpactReport {
    pub symbol_id:        String,
    pub symbol_name:      String,
    pub direct_callers:   Vec<JsSymbolRef>,
    pub transitive_count: u32,
}

#[napi(object)]
pub struct JsCallGraphStats {
    pub file_count:       u32,
    pub raw_edge_count:   u32,
    pub resolved_count:   u32,
    pub unresolved_count: u32,
    pub duration_ms:      u32,
}

// ── NAPI functions ────────────────────────────────────────────────────────────

/// Full workspace call graph build (TypeScript/JS first).
/// Extracts call sites, resolves to SymbolIds, persists to SQLite, hydrates RAM graph.
#[napi]
pub fn build_symbol_call_graph(
    workspace_root: String,
    symbol_db_path: String,
    call_db_path:   String,
) -> Result<JsCallGraphStats> {
    with_service(&workspace_root, |svc| {
        let stats = svc.build_call_graph(&symbol_db_path, &call_db_path)?;
        Ok(JsCallGraphStats {
            file_count:       stats.file_count as u32,
            raw_edge_count:   stats.raw_edge_count as u32,
            resolved_count:   stats.resolved_count as u32,
            unresolved_count: stats.unresolved_count as u32,
            duration_ms:      stats.duration_ms as u32,
        })
    })
}

/// Hydrate RAM graph from existing SQLite data (fast cold start).
#[napi]
pub fn hydrate_symbol_graph(
    workspace_root: String,
    call_db_path:   String,
) -> Result<u32> {
    with_service(&workspace_root, |svc| {
        Ok(svc.hydrate_from_db(&call_db_path)? as u32)
    })
}

/// Incremental update for one file (call after file save).
#[napi]
pub fn update_symbol_file(
    workspace_root:  String,
    file_path:       String,
    symbol_db_path:  String,
    call_db_path:    String,
) -> Result<u32> {
    with_service(&workspace_root, |svc| {
        Ok(svc.update_file(&file_path, &symbol_db_path, &call_db_path)? as u32)
    })
}

/// Find all direct callers of a symbol.
#[napi]
pub fn find_symbol_callers(
    workspace_root: String,
    symbol_id:      String,
    symbol_db_path: String,
) -> Result<Vec<JsSymbolRef>> {
    with_service(&workspace_root, |svc| {
        let refs = svc.find_callers(&symbol_id, &symbol_db_path)?;
        Ok(refs.into_iter().map(js_sym).collect())
    })
}

/// Find all direct callees of a symbol.
#[napi]
pub fn find_symbol_callees(
    workspace_root: String,
    symbol_id:      String,
    symbol_db_path: String,
) -> Result<Vec<JsSymbolRef>> {
    with_service(&workspace_root, |svc| {
        let refs = svc.find_callees(&symbol_id, &symbol_db_path)?;
        Ok(refs.into_iter().map(js_sym).collect())
    })
}

/// Find implementations of an interface (by name).
#[napi]
pub fn find_symbol_implementations(
    workspace_root:  String,
    interface_name:  String,
    symbol_db_path:  String,
) -> Result<Vec<JsSymbolRef>> {
    with_service(&workspace_root, |svc| {
        let refs = svc.find_implementations(&interface_name, &symbol_db_path)?;
        Ok(refs.into_iter().map(js_sym).collect())
    })
}

/// Trace execution flow from a starting symbol (BFS downstream, max 10 hops).
#[napi]
pub fn trace_execution_flow(
    workspace_root: String,
    start_symbol_id: String,
    max_depth:      u32,
    symbol_db_path: String,
) -> Result<JsFlowPath> {
    with_service(&workspace_root, |svc| {
        let path = svc.trace_flow(&start_symbol_id, max_depth.min(10) as u8, &symbol_db_path)?;
        Ok(JsFlowPath {
            total_hops:        path.total_hops as u32,
            max_depth_reached: path.max_depth_reached,
            steps: path.steps.into_iter().map(js_step).collect(),
        })
    })
}

/// Get impact report for a symbol (direct callers + transitive count).
#[napi]
pub fn get_symbol_impact(
    workspace_root: String,
    symbol_id:      String,
    symbol_db_path: String,
) -> Result<JsImpactReport> {
    with_service(&workspace_root, |svc| {
        let report = svc.get_impact(&symbol_id, &symbol_db_path)?;
        Ok(JsImpactReport {
            symbol_id:        report.symbol_id,
            symbol_name:      report.symbol_name,
            direct_callers:   report.direct_callers.into_iter().map(js_sym).collect(),
            transitive_count: report.transitive_count as u32,
        })
    })
}

// ── Converters ────────────────────────────────────────────────────────────────

fn js_sym(s: SymbolRef) -> JsSymbolRef {
    JsSymbolRef { id: s.id, name: s.name, kind: s.kind, file: s.file, line: s.line, container: s.container }
}

fn js_step(s: FlowStep) -> JsFlowStep {
    JsFlowStep { symbol: js_sym(s.symbol), via_file: s.via_file, via_line: s.via_line }
}

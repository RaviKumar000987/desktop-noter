use napi_derive::napi;
use napi::bindgen_prelude::*;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use noter_code_graph::{CodeGraphService, ImpactResult};

// ── Singleton: one CodeGraphService per workspace root ────────────────────────

static GRAPHS: OnceLock<Mutex<HashMap<String, CodeGraphService>>> = OnceLock::new();

fn graphs() -> &'static Mutex<HashMap<String, CodeGraphService>> {
    GRAPHS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn with_service<F, R>(root: &str, f: F) -> Result<R>
where F: FnOnce(&mut CodeGraphService) -> anyhow::Result<R>
{
    let mut guard = graphs().lock().map_err(|e| Error::from_reason(e.to_string()))?;
    let svc = guard.entry(root.to_string())
        .or_insert_with(|| CodeGraphService::new(root));
    f(svc).map_err(|e| Error::from_reason(e.to_string()))
}

// ── JS-facing types ───────────────────────────────────────────────────────────

#[napi(object)]
pub struct JsGraphStats {
    pub file_count:        u32,
    pub symbol_count:      u32,
    pub edge_count:        u32,
    pub import_edge_count: u32,
    pub duration_ms:       u32,
    pub is_built:          bool,
}

#[napi(object)]
pub struct JsGraphNode {
    pub name:        String,
    pub kind:        String,
    pub file:        String,
    pub line:        u32,
    pub is_exported: bool,
    pub language:    String,
}

#[napi(object)]
pub struct JsImpactResult {
    pub target_name:          String,
    pub target_file:          String,
    pub affected_files:       Vec<String>,
    pub affected_symbols:     Vec<String>,
    pub affected_file_count:  u32,
    pub affected_symbol_count: u32,
    pub max_depth:            u32,
}

#[napi(object)]
pub struct JsUnusedSymbol {
    pub name: String,
    pub file: String,
    pub line: u32,
    pub kind: String,
}

#[napi(object)]
pub struct JsCycle {
    pub files: Vec<String>,
}

#[napi(object)]
pub struct JsArchViolation {
    pub description: String,
    pub from_file:   String,
    pub to_file:     String,
    pub rule:        String,
}

// ── NAPI functions ────────────────────────────────────────────────────────────

/// Build the code graph for a workspace root.
/// On first call: full build. Subsequent calls return cached stats (use invalidate to force rebuild).
#[napi]
pub fn build_code_graph(root: String) -> Result<JsGraphStats> {
    with_service(&root, |svc| {
        if !svc.is_built() { svc.build()?; }
        let s = svc.stats().cloned().unwrap_or_default();
        Ok(JsGraphStats {
            file_count:        s.file_count        as u32,
            symbol_count:      s.symbol_count      as u32,
            edge_count:        s.edge_count        as u32,
            import_edge_count: s.import_edge_count as u32,
            duration_ms:       s.duration_ms       as u32,
            is_built:          true,
        })
    })
}

/// Incremental update: rebuild only the nodes/edges for one changed file.
/// Called by Phase 1.75 WatchEngine on FileReindexed events.
#[napi]
pub fn update_graph_file(root: String, file_path: String) -> Result<bool> {
    with_service(&root, |svc| Ok(svc.update_file(&file_path)))
}

/// Drop the graph — next build_code_graph() call triggers a fresh full build.
#[napi]
pub fn invalidate_code_graph(root: String) -> Result<()> {
    with_service(&root, |svc| { svc.invalidate(); Ok(()) })
}

/// Get current graph stats without triggering a build.
#[napi]
pub fn get_graph_stats(root: String) -> Result<Option<JsGraphStats>> {
    let guard = graphs().lock().map_err(|e| Error::from_reason(e.to_string()))?;
    if let Some(svc) = guard.get(&root) {
        if svc.is_built() {
            let s = svc.stats().cloned().unwrap_or_default();
            return Ok(Some(JsGraphStats {
                file_count: s.file_count as u32, symbol_count: s.symbol_count as u32,
                edge_count: s.edge_count as u32, import_edge_count: s.import_edge_count as u32,
                duration_ms: s.duration_ms as u32, is_built: true,
            }));
        }
    }
    Ok(None)
}

/// Find nodes by symbol name (case-sensitive).
#[napi]
pub fn query_graph_node(root: String, name: String) -> Result<Vec<JsGraphNode>> {
    with_service(&root, |svc| {
        Ok(svc.node_by_name(&name)?.into_iter().map(into_js_node).collect())
    })
}

/// All files that `file_path` directly imports.
#[napi]
pub fn get_file_imports(root: String, file_path: String) -> Result<Vec<JsGraphNode>> {
    with_service(&root, |svc| {
        Ok(svc.file_imports(&file_path)?.into_iter().map(into_js_node).collect())
    })
}

/// All files that directly import `file_path`.
#[napi]
pub fn get_file_importers(root: String, file_path: String) -> Result<Vec<JsGraphNode>> {
    with_service(&root, |svc| {
        Ok(svc.file_importers(&file_path)?.into_iter().map(into_js_node).collect())
    })
}

/// Impact analysis: who breaks if `file_path` is deleted/changed?
#[napi]
pub fn analyze_impact(root: String, file_path: String) -> Result<JsImpactResult> {
    with_service(&root, |svc| {
        let r = svc.impact_of(&file_path)?;
        Ok(JsImpactResult {
            target_name:          r.target_name,
            target_file:          r.target_file,
            affected_files:       r.affected_files,
            affected_symbols:     r.affected_symbols,
            affected_file_count:  r.affected_file_count  as u32,
            affected_symbol_count: r.affected_symbol_count as u32,
            max_depth:            r.max_depth            as u32,
        })
    })
}

/// Exported symbols with no incoming references (dead code candidates).
#[napi]
pub fn find_dead_code(root: String) -> Result<Vec<JsUnusedSymbol>> {
    with_service(&root, |svc| {
        Ok(svc.unused_exports()?.into_iter().map(|u| JsUnusedSymbol {
            name: u.name, file: u.file, line: u.line, kind: u.kind,
        }).collect())
    })
}

/// Circular import cycles detected via Tarjan SCC.
#[napi]
pub fn find_dependency_cycles(root: String) -> Result<Vec<JsCycle>> {
    with_service(&root, |svc| {
        Ok(svc.dependency_cycles()?.into_iter().map(|c| JsCycle { files: c.files }).collect())
    })
}

/// Architecture violations for a given pattern ("mvc", "clean", "layered").
#[napi]
pub fn check_arch_violations(root: String, pattern: String) -> Result<Vec<JsArchViolation>> {
    with_service(&root, |svc| {
        Ok(svc.arch_violations(&pattern)?.into_iter().map(|v| JsArchViolation {
            description: v.description, from_file: v.from_file, to_file: v.to_file, rule: v.rule,
        }).collect())
    })
}

/// Shortest import path from one file to another.
#[napi]
pub fn find_import_path(root: String, from_file: String, to_file: String) -> Result<Option<Vec<String>>> {
    with_service(&root, |svc| svc.find_path(&from_file, &to_file))
}

// ── Conversion helpers ────────────────────────────────────────────────────────

fn into_js_node(n: noter_code_graph::GraphNode) -> JsGraphNode {
    JsGraphNode {
        name: n.name, kind: n.kind.to_string(),
        file: n.file, line: n.line,
        is_exported: n.is_exported, language: n.language,
    }
}

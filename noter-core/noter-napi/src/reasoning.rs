use napi_derive::napi;
use napi::bindgen_prelude::*;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use noter_reasoning_engine::{ReasoningService, ReasoningReport};

// ── Singleton: one service per workspace ─────────────────────────────────────

static SERVICES: OnceLock<Mutex<HashMap<String, ReasoningService>>> = OnceLock::new();

fn services() -> &'static Mutex<HashMap<String, ReasoningService>> {
    SERVICES.get_or_init(|| Mutex::new(HashMap::new()))
}

fn with_service<F, T>(root: &str, f: F) -> std::result::Result<T, Error>
where F: FnOnce(&mut ReasoningService) -> anyhow::Result<T>
{
    let mut map = services().lock().map_err(|e| Error::from_reason(e.to_string()))?;
    let svc = map.entry(root.to_string()).or_insert_with(|| ReasoningService::new(root));
    f(svc).map_err(|e| Error::from_reason(e.to_string()))
}

// ── JS-facing types ───────────────────────────────────────────────────────────

#[napi(object)]
pub struct JsRiskItem {
    pub file:      String,
    pub full_path: String,
    pub callers:   String,
    pub risk:      u32,
    pub level:     String,
}

#[napi(object)]
pub struct JsHealthScore {
    pub total:        u32,
    pub architecture: u32,
    pub debt:         u32,
    pub complexity:   u32,
    pub risk:         u32,
}

#[napi(object)]
pub struct JsRecommendation {
    pub priority: String,
    pub icon:     String,
    pub title:    String,
    pub detail:   String,
}

#[napi(object)]
pub struct JsDeadSymbol {
    pub name: String,
    pub file: String,
    pub line: u32,
    pub kind: String,
}

#[napi(object)]
pub struct JsCycleR {
    pub files: Vec<String>,
}

#[napi(object)]
pub struct JsArchViolationR {
    pub description: String,
    pub from_file:   String,
    pub to_file:     String,
    pub rule:        String,
}

#[napi(object)]
pub struct JsLargeFile {
    pub path: String,
    pub name: String,
}

#[napi(object)]
pub struct JsReasoningReport {
    pub dead_code:       Vec<JsDeadSymbol>,
    pub cycles:          Vec<JsCycleR>,
    pub arch_violations: Vec<JsArchViolationR>,
    pub large_files:     Vec<JsLargeFile>,
    pub risk_items:      Vec<JsRiskItem>,
    pub health:          JsHealthScore,
    pub recommendations: Vec<JsRecommendation>,
}

// ── NAPI functions ────────────────────────────────────────────────────────────

/// Full project analysis: risk + health + debt + recommendations.
/// All computation runs in Rust — renderer just displays the result.
#[napi]
pub fn analyze_project(root: String) -> Result<JsReasoningReport> {
    with_service(&root, |svc| {
        let r = svc.analyze()?;
        Ok(into_js_report(r))
    })
}

/// Risk items only (fast path).
#[napi]
pub fn get_project_risk(root: String) -> Result<Vec<JsRiskItem>> {
    with_service(&root, |svc| {
        let r = svc.analyze()?;
        Ok(r.risk_items.into_iter().map(into_js_risk).collect())
    })
}

/// Debt report only (dead code + cycles + arch violations).
#[napi]
pub fn get_project_debt(root: String) -> Result<JsReasoningReport> {
    with_service(&root, |svc| {
        let r = svc.analyze()?;
        Ok(into_js_report(r))
    })
}

/// Force re-analysis on next call (call after workspace changes).
#[napi]
pub fn invalidate_reasoning(root: String) -> Result<()> {
    with_service(&root, |svc| { svc.invalidate(); Ok(()) })
}

// ── Converters ────────────────────────────────────────────────────────────────

fn into_js_report(r: ReasoningReport) -> JsReasoningReport {
    JsReasoningReport {
        dead_code:       r.dead_code.into_iter().map(|d| JsDeadSymbol { name: d.name, file: d.file, line: d.line, kind: d.kind }).collect(),
        cycles:          r.cycles.into_iter().map(|c| JsCycleR { files: c.files }).collect(),
        arch_violations: r.arch_violations.into_iter().map(|v| JsArchViolationR { description: v.description, from_file: v.from_file, to_file: v.to_file, rule: v.rule }).collect(),
        large_files:     r.large_files.into_iter().map(|f| JsLargeFile { path: f.path, name: f.name }).collect(),
        risk_items:      r.risk_items.into_iter().map(into_js_risk).collect(),
        health:          JsHealthScore {
            total:        r.health.total,
            architecture: r.health.architecture,
            debt:         r.health.debt,
            complexity:   r.health.complexity,
            risk:         r.health.risk,
        },
        recommendations: r.recommendations.into_iter().map(|rec| JsRecommendation {
            priority: rec.priority, icon: rec.icon, title: rec.title, detail: rec.detail,
        }).collect(),
    }
}

fn into_js_risk(r: noter_reasoning_engine::RiskItem) -> JsRiskItem {
    JsRiskItem { file: r.file, full_path: r.full_path, callers: r.callers, risk: r.risk, level: r.level }
}

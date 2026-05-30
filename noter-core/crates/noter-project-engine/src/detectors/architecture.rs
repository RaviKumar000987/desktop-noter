/// Layer 4 — architecture pattern detector.
/// Reads directory structure (not file contents) to classify project architecture.
use std::path::Path;
use walkdir::WalkDir;
use crate::models::{ArchitectureInfo, ArchPattern};

const SKIP_DIRS: &[&str] = &[
    "node_modules", ".git", "target", "dist", "build",
    ".next", "__pycache__", "vendor", ".cache", "coverage",
];

pub fn detect(root: &Path) -> ArchitectureInfo {
    let dirs = collect_dirs(root);

    // Each detector returns (pattern, confidence, evidence).
    // We pick the highest-confidence one above threshold 30.
    let candidates = [
        score_mvc(&dirs),
        score_clean(&dirs),
        score_hexagonal(&dirs),
        score_nextjs(root, &dirs),
        score_spa(&dirs),
        score_microservice(root),
        score_layered(&dirs),
        score_library(&dirs),
    ];

    let best = candidates.iter().max_by_key(|(_, conf, _)| *conf);
    if let Some((pattern, confidence, evidence)) = best {
        if *confidence >= 30 {
            return ArchitectureInfo {
                pattern: pattern.clone(),
                confidence: *confidence,
                evidence: evidence.clone(),
            };
        }
    }

    ArchitectureInfo { pattern: ArchPattern::Unknown, confidence: 0, evidence: vec![] }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn collect_dirs(root: &Path) -> Vec<String> {
    WalkDir::new(root)
        .max_depth(5)
        .into_iter()
        .flatten()
        .filter(|e| e.file_type().is_dir())
        .filter_map(|e| {
            let rel = e.path()
                .strip_prefix(root).ok()?
                .to_string_lossy()
                .replace('\\', "/")
                .to_lowercase();
            if rel.is_empty() { return None; }
            // Exclude skip dirs anywhere in path
            if SKIP_DIRS.iter().any(|skip| rel.starts_with(skip) || rel.contains(&format!("/{}", skip))) {
                return None;
            }
            Some(rel)
        })
        .collect()
}

fn has(dirs: &[String], segment: &str) -> bool {
    dirs.iter().any(|d| d == segment || d.ends_with(&format!("/{}", segment)) || d.contains(&format!("/{}/", segment)))
}

// ── Scorers ───────────────────────────────────────────────────────────────────

fn score_mvc(dirs: &[String]) -> (ArchPattern, u8, Vec<String>) {
    let mut s = 0u8;
    let mut ev = Vec::new();
    if has(dirs, "controllers") || has(dirs, "controller") { s += 35; ev.push("controllers/".into()); }
    if has(dirs, "services")    || has(dirs, "service")    { s += 35; ev.push("services/".into()); }
    if has(dirs, "models")      || has(dirs, "model")      { s += 30; ev.push("models/".into()); }
    (ArchPattern::Mvc, s.min(95), ev)
}

fn score_clean(dirs: &[String]) -> (ArchPattern, u8, Vec<String>) {
    let mut s = 0u8;
    let mut ev = Vec::new();
    if has(dirs, "domain")                                       { s += 35; ev.push("domain/".into()); }
    if has(dirs, "application") || has(dirs, "usecase") || has(dirs, "use_case") || has(dirs, "usecases") {
        s += 35; ev.push("application/".into());
    }
    if has(dirs, "infrastructure") || has(dirs, "infra")         { s += 30; ev.push("infrastructure/".into()); }
    (ArchPattern::Clean, s.min(95), ev)
}

fn score_hexagonal(dirs: &[String]) -> (ArchPattern, u8, Vec<String>) {
    let mut s = 0u8;
    let mut ev = Vec::new();
    if has(dirs, "ports")    { s += 45; ev.push("ports/".into()); }
    if has(dirs, "adapters") { s += 45; ev.push("adapters/".into()); }
    if has(dirs, "domain")   { s += 10; ev.push("domain/".into()); }
    (ArchPattern::Hexagonal, s.min(95), ev)
}

fn score_layered(dirs: &[String]) -> (ArchPattern, u8, Vec<String>) {
    let mut s = 0u8;
    let mut ev = Vec::new();
    if has(dirs, "repositories") || has(dirs, "repository") { s += 35; ev.push("repositories/".into()); }
    if has(dirs, "services")     || has(dirs, "service")    { s += 35; ev.push("services/".into()); }
    if has(dirs, "routes")       || has(dirs, "route")      { s += 30; ev.push("routes/".into()); }
    (ArchPattern::Layered, s.min(88), ev)
}

fn score_nextjs(root: &Path, dirs: &[String]) -> (ArchPattern, u8, Vec<String>) {
    let mut s = 0u8;
    let mut ev = Vec::new();
    if root.join("next.config.js").exists() || root.join("next.config.mjs").exists() || root.join("next.config.ts").exists() {
        s += 40; ev.push("next.config.*".into());
    }
    if has(dirs, "app") { s += 35; ev.push("app/".into()); }
    if has(dirs, "pages") { s += 25; ev.push("pages/".into()); }
    (ArchPattern::NextJs, s.min(95), ev)
}

fn score_spa(dirs: &[String]) -> (ArchPattern, u8, Vec<String>) {
    let mut s = 0u8;
    let mut ev = Vec::new();
    if has(dirs, "components") || has(dirs, "component") { s += 40; ev.push("components/".into()); }
    if has(dirs, "pages")      || has(dirs, "views")     { s += 30; ev.push("pages/".into()); }
    if has(dirs, "hooks")      || has(dirs, "hook")      { s += 30; ev.push("hooks/".into()); }
    (ArchPattern::SpaFrontend, s.min(85), ev)
}

fn score_microservice(root: &Path) -> (ArchPattern, u8, Vec<String>) {
    let mut s = 0u8;
    let mut ev = Vec::new();
    if root.join("docker-compose.yml").exists() || root.join("docker-compose.yaml").exists() {
        s += 40; ev.push("docker-compose.yml".into());
    }
    if root.join("Dockerfile").exists() { s += 25; ev.push("Dockerfile".into()); }
    if root.join("kubernetes").exists() || root.join("k8s").exists() { s += 35; ev.push("kubernetes/".into()); }
    (ArchPattern::Microservice, s.min(90), ev)
}

fn score_library(dirs: &[String]) -> (ArchPattern, u8, Vec<String>) {
    let mut s = 0u8;
    let mut ev = Vec::new();
    if has(dirs, "src")                                          { s += 30; ev.push("src/".into()); }
    if has(dirs, "tests") || has(dirs, "test") || has(dirs, "__tests__") { s += 40; ev.push("tests/".into()); }
    if has(dirs, "examples") || has(dirs, "example")            { s += 30; ev.push("examples/".into()); }
    (ArchPattern::Library, s.min(78), ev)
}

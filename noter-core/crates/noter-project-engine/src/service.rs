use std::path::Path;
use std::time::Instant;
use anyhow::Result;
use tracing::{info, warn};
use crate::{
    cache::{hash_manifests, ProjectCache},
    detectors::{architecture, framework as framework_detector},
    graph::builder as graph_builder,
    manifest::{cargo as cargo_manifest, go, java, npm, python},
    models::ProjectInfo,
    project_map::builder as map_builder,
};

pub struct ProjectEngineService {
    cache: ProjectCache,
}

impl ProjectEngineService {
    pub fn new() -> Self {
        Self { cache: ProjectCache::new() }
    }

    /// Full workspace scan. Returns cached result if manifests are unchanged.
    pub fn scan(&mut self, root_str: &str) -> Result<ProjectInfo> {
        let root = Path::new(root_str);
        let manifest_hash = hash_manifests(root);

        if let Some(cached) = self.cache.get(root_str, manifest_hash) {
            info!("project-engine: cache hit for {}", root_str);
            return Ok(cached.clone());
        }

        info!("project-engine: scanning {}", root_str);
        let start = Instant::now();

        let mut all_deps = Vec::new();
        let mut all_frameworks = Vec::new();
        let mut languages: Vec<String> = Vec::new();

        // ── Layer 1: Manifest parsers ─────────────────────────────────────────

        if let Ok(Some((deps, fw))) = npm::parse(root) {
            all_deps.extend(deps);
            all_frameworks.extend(fw);
            push_lang(&mut languages, "JavaScript");
            if root.join("tsconfig.json").exists() || root.join("tsconfig.base.json").exists() {
                push_lang(&mut languages, "TypeScript");
            }
        }

        if let Ok(Some((deps, fw))) = cargo_manifest::parse(root) {
            all_deps.extend(deps);
            all_frameworks.extend(fw);
            push_lang(&mut languages, "Rust");
        }

        if let Ok(Some((deps, fw))) = python::parse(root) {
            all_deps.extend(deps);
            all_frameworks.extend(fw);
            push_lang(&mut languages, "Python");
        }

        if let Ok(Some((deps, fw))) = go::parse(root) {
            all_deps.extend(deps);
            all_frameworks.extend(fw);
            push_lang(&mut languages, "Go");
        }

        if let Ok(Some((deps, fw))) = java::parse(root) {
            all_deps.extend(deps);
            all_frameworks.extend(fw);
            push_lang(&mut languages, "Java");
        }

        // ── Layer 2: Source import scan ───────────────────────────────────────
        let source_fw = framework_detector::scan(root, &all_frameworks);
        all_frameworks.extend(source_fw);

        // ── Layer 3: Dependency graph ─────────────────────────────────────────
        let _dep_graph = graph_builder::build(&all_deps);

        // ── Layer 4: Architecture detection ───────────────────────────────────
        let architecture = architecture::detect(root);

        // ── Layer 5: Project map ──────────────────────────────────────────────
        let project_map = map_builder::build(root);

        let scan_duration_ms = start.elapsed().as_millis() as u64;

        info!(
            "project-engine: scan complete in {}ms — {} deps, {} frameworks, {} map modules",
            scan_duration_ms,
            all_deps.len(),
            all_frameworks.len(),
            project_map.modules.len(),
        );

        if scan_duration_ms > 2000 {
            warn!("project-engine: scan exceeded 2s target ({}ms)", scan_duration_ms);
        }

        let info = ProjectInfo {
            workspace_root: root_str.to_string(),
            languages,
            frameworks: all_frameworks,
            dependencies: all_deps,
            architecture,
            project_map,
            scan_duration_ms,
        };

        self.cache.insert(root_str.to_string(), manifest_hash, info.clone());
        Ok(info)
    }

    pub fn invalidate_cache(&mut self, root: &str) {
        self.cache.invalidate(root);
    }
}

impl Default for ProjectEngineService {
    fn default() -> Self { Self::new() }
}

fn push_lang(langs: &mut Vec<String>, lang: &str) {
    if !langs.iter().any(|l| l == lang) {
        langs.push(lang.to_string());
    }
}

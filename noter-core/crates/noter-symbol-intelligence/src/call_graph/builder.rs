/// Call graph builder — orchestrates extract → resolve → hydrate RAM graph.
use std::fs;
use std::path::Path;
use std::time::Instant;
use anyhow::Result;
use rayon::prelude::*;
use tracing::{info, warn};
use walkdir::WalkDir;

use crate::models::{CallEdge, CallGraphStats};
use crate::call_graph::{extractor, resolver};
use crate::db::storage;

const SKIP_DIRS: &[&str] = &[
    "node_modules", ".git", "target", "dist", "build",
    ".next", "__pycache__", "vendor", ".cache", "coverage", ".turbo",
];

const SUPPORTED_EXTS: &[&str] = &["ts", "tsx", "js", "jsx", "mjs"];

/// Scan workspace, extract call sites, resolve to SymbolIds, persist to SQLite.
/// Returns all resolved edges (used to hydrate in-memory graph).
pub fn build(
    workspace_root: &str,
    symbol_db_path: &str,
    call_db_path: &str,
) -> Result<(Vec<CallEdge>, CallGraphStats)> {
    let start = Instant::now();
    let root = Path::new(workspace_root);

    info!("symbol-intelligence: scanning {}", workspace_root);

    // Collect source files
    let files: Vec<_> = WalkDir::new(root)
        .max_depth(12)
        .into_iter()
        .flatten()
        .filter(|e| e.file_type().is_file())
        .filter(|e| {
            let rel = e.path()
                .strip_prefix(root)
                .unwrap_or(e.path())
                .to_string_lossy()
                .replace('\\', "/");
            !SKIP_DIRS.iter().any(|s| rel.starts_with(s) || rel.contains(&format!("/{s}/")))
        })
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|x| x.to_str())
                .map(|ext| SUPPORTED_EXTS.contains(&ext))
                .unwrap_or(false)
        })
        .map(|e| e.path().to_path_buf())
        .collect();

    let file_count = files.len();
    info!("symbol-intelligence: {} source files to process", file_count);

    // Parallel extraction
    let raw_sites: Vec<_> = files.par_iter().flat_map(|path| {
        let Ok(source) = fs::read_to_string(path) else { return vec![]; };
        let file_str = path.to_string_lossy().replace('\\', "/");
        extractor::extract_call_sites(&source, path)
            .into_iter()
            .map(|site| (file_str.clone(), site))
            .collect::<Vec<_>>()
    }).collect();

    let raw_count = raw_sites.len();

    // Resolution pass (single-threaded — SQLite connection not Send)
    let mut resolved_edges = Vec::new();
    let mut unresolved = 0usize;

    for (file, site) in &raw_sites {
        // Resolve caller
        let caller_resolved = resolver::resolve(&site.caller_name, file, symbol_db_path)?;
        let caller_id = match caller_resolved {
            Some(r) => r.id,
            None    => { unresolved += 1; continue; }
        };

        // Resolve callee
        let callee_resolved = resolver::resolve(&site.callee_name, file, symbol_db_path)?;
        let (callee_id, confidence) = match callee_resolved {
            Some(r) => (Some(r.id), r.confidence),
            None    => (None, 70),
        };

        resolved_edges.push(CallEdge {
            caller_id,
            callee_id,
            callee_name:    site.callee_name.clone(),
            call_site_file: file.to_string(),
            call_site_line: site.line,
            call_site_col:  site.col,
            is_async:       site.is_async,
            confidence,
        });
    }

    let resolved_count = resolved_edges.iter().filter(|e| e.callee_id.is_some()).count();
    let duration_ms = start.elapsed().as_millis() as u64;

    info!(
        "symbol-intelligence: {} files, {} raw sites, {} resolved, {} unresolved, {}ms",
        file_count, raw_count, resolved_count, unresolved, duration_ms
    );

    if duration_ms > 2000 {
        warn!("symbol-intelligence: build exceeded 2s target ({}ms)", duration_ms);
    }

    // Persist to SQLite (background would be better, but synchronous for MVP)
    if !resolved_edges.is_empty() {
        storage::persist(&resolved_edges, workspace_root, call_db_path)?;
    }

    let stats = CallGraphStats {
        file_count,
        raw_edge_count:   raw_count,
        resolved_count,
        unresolved_count: raw_count - resolved_count,
        duration_ms,
    };

    Ok((resolved_edges, stats))
}

/// Re-build call edges for a single file (incremental update).
pub fn build_file(
    file_path: &str,
    workspace_root: &str,
    symbol_db_path: &str,
    call_db_path: &str,
) -> Result<Vec<CallEdge>> {
    let source = fs::read_to_string(file_path)?;
    let path = Path::new(file_path);
    let sites = extractor::extract_call_sites(&source, path);

    let mut edges = Vec::new();
    for site in &sites {
        let caller = resolver::resolve(&site.caller_name, file_path, symbol_db_path)?;
        let caller_id = match caller { Some(r) => r.id, None => continue };
        let callee = resolver::resolve(&site.callee_name, file_path, symbol_db_path)?;
        let (callee_id, confidence) = match callee {
            Some(r) => (Some(r.id), r.confidence),
            None    => (None, 70),
        };
        edges.push(CallEdge {
            caller_id,
            callee_id,
            callee_name:    site.callee_name.clone(),
            call_site_file: file_path.to_string(),
            call_site_line: site.line,
            call_site_col:  site.col,
            is_async:       site.is_async,
            confidence,
        });
    }

    // Delete old edges for this file and write new ones
    storage::delete_file_edges(file_path, workspace_root, call_db_path)?;
    if !edges.is_empty() {
        storage::persist(&edges, workspace_root, call_db_path)?;
    }

    Ok(edges)
}

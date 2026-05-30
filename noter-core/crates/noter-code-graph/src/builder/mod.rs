/// Layer 2 — Graph Builder.
/// Two-pass construction:
///   Pass 1: create File nodes for every source file (populates file_nodes map)
///   Pass 2: extract symbols + imports, create symbol nodes + edges
/// Two-pass is necessary so import edges can reference File nodes
/// that haven't been processed yet.
use std::time::Instant;
use tracing::info;
use walkdir::WalkDir;

use crate::graph::{CodeGraphData, NodeId};
use crate::models::{EdgeKind, GraphBuildStats, GraphNode, NodeKind, language_from_ext};
use crate::resolver::ImportResolver;
use crate::symbols::analyze_file;

const SKIP_DIRS: &[&str] = &[
    "node_modules", ".git", "target", "dist", "build",
    ".next", "__pycache__", "vendor", ".cache", "coverage",
    ".turbo", ".vercel", ".svelte-kit", ".parcel-cache",
];
const SOURCE_EXTS: &[&str] = &["ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "rs", "go", "java"];

pub fn build(workspace_root: &str) -> (CodeGraphData, GraphBuildStats) {
    let start = Instant::now();
    let resolver = ImportResolver::new(workspace_root);
    let files = collect_source_files(workspace_root);
    let mut data = CodeGraphData::new();
    let mut unresolved = 0usize;

    info!("code-graph: building from {} files in {}", files.len(), workspace_root);

    // ── Pass 1: File nodes ────────────────────────────────────────────────────
    for file in &files {
        let ext = std::path::Path::new(file)
            .extension().and_then(|e| e.to_str()).unwrap_or("");
        let lang = language_from_ext(ext);
        let node = GraphNode::file_node(file, lang);
        let id = data.add_node(node);
        data.register_file_node(file, id);
    }

    // ── Pass 2: Symbols + import edges ────────────────────────────────────────
    for file in &files {
        let file_node_id = match data.file_node_of(file) {
            Some(id) => id,
            None => continue,
        };

        let analysis = analyze_file(&format!("{}/{}", workspace_root, file));

        // Symbol nodes + Contains/Exports edges
        for sym in &analysis.symbols {
            let node = GraphNode {
                name: sym.name.clone(),
                kind: sym.kind.clone(),
                file: file.clone(),
                line: sym.line,
                is_exported: sym.is_exported,
                language: analysis.language.clone(),
            };
            let sym_id = data.add_node(node);
            data.add_edge(file_node_id, sym_id, EdgeKind::Contains);
            if sym.is_exported {
                data.add_edge(file_node_id, sym_id, EdgeKind::Exports);
            }
        }

        // Import edges (File → File)
        for import in &analysis.imports {
            match resolver.resolve(
                &format!("{}/{}", workspace_root, file),
                &import.path,
            ) {
                Some(target_rel) => {
                    if let Some(target_id) = data.file_node_of(&target_rel) {
                        data.add_edge(file_node_id, target_id, EdgeKind::Imports);
                    }
                }
                None => { unresolved += 1; }
            }
        }
    }

    let duration_ms = start.elapsed().as_millis() as u64;
    let stats = GraphBuildStats {
        file_count:           data.file_count(),
        symbol_count:         data.symbol_count(),
        edge_count:           data.edge_count(),
        import_edge_count:    data.import_edge_count(),
        unresolved_import_count: unresolved,
        duration_ms,
    };

    info!(
        "code-graph: built — {} files, {} symbols, {} edges, {} imports, {}ms",
        stats.file_count, stats.symbol_count, stats.edge_count, stats.import_edge_count, duration_ms
    );

    (data, stats)
}

/// Rebuild only the nodes/edges for one file (called on FileReindexed event).
/// Returns true if the file was in the graph (false = new file, added for first time).
pub fn rebuild_file(data: &mut CodeGraphData, workspace_root: &str, file_rel: &str) -> bool {
    let existed = data.file_node_of(file_rel).is_some();
    let resolver = ImportResolver::new(workspace_root);

    // Remove old nodes/edges
    data.remove_file(file_rel);

    // Re-add File node
    let ext = std::path::Path::new(file_rel)
        .extension().and_then(|e| e.to_str()).unwrap_or("");
    let lang = language_from_ext(ext);
    let file_node = GraphNode::file_node(file_rel, lang);
    let file_id = data.add_node(file_node);
    data.register_file_node(file_rel, file_id);

    // Re-extract and re-add
    let analysis = analyze_file(&format!("{}/{}", workspace_root, file_rel));

    for sym in &analysis.symbols {
        let sym_node = GraphNode {
            name: sym.name.clone(),
            kind: sym.kind.clone(),
            file: file_rel.to_string(),
            line: sym.line,
            is_exported: sym.is_exported,
            language: analysis.language.clone(),
        };
        let sym_id = data.add_node(sym_node);
        data.add_edge(file_id, sym_id, EdgeKind::Contains);
        if sym.is_exported { data.add_edge(file_id, sym_id, EdgeKind::Exports); }
    }

    for import in &analysis.imports {
        if let Some(target_rel) = resolver.resolve(
            &format!("{}/{}", workspace_root, file_rel),
            &import.path,
        ) {
            if let Some(target_id) = data.file_node_of(&target_rel) {
                data.add_edge(file_id, target_id, EdgeKind::Imports);
            }
        }
    }

    existed
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn collect_source_files(root: &str) -> Vec<String> {
    WalkDir::new(root)
        .max_depth(12)
        .into_iter()
        .flatten()
        .filter(|e| e.file_type().is_file())
        .filter(|e| {
            let rel = e.path().to_string_lossy().replace('\\', "/").to_lowercase();
            !SKIP_DIRS.iter().any(|d| rel.contains(&format!("/{}/", d)) || rel.starts_with(&format!("{}/", d)))
        })
        .filter(|e| {
            e.path().extension()
                .and_then(|x| x.to_str())
                .map(|ext| SOURCE_EXTS.contains(&ext))
                .unwrap_or(false)
        })
        .filter_map(|e| {
            e.path().strip_prefix(root).ok()
                .map(|rel| rel.to_string_lossy().replace('\\', "/"))
        })
        .collect()
}

/// Layer 1 + Layer 3 — Symbol Registry extraction.
///
/// Uses regex (not tree-sitter) for import/export detection because:
///   1. Import statements have predictable structure — regex is reliable.
///   2. tree-sitter queries per language would be 5x more code.
///   3. Speed: regex on 64KB file ≈ 2-5ms vs tree-sitter ≈ 10-20ms.
///
/// Phase 2.1 (Symbol Intelligence) will replace this with full tree-sitter
/// queries that resolve call graphs and type references.
use std::fs;
use std::path::Path;
use once_cell::sync::Lazy;
use regex::Regex;

use crate::models::{ExtractedImport, ExtractedSymbol, FileAnalysis, NodeKind, language_from_ext};

// ── Compiled regex patterns (compiled once, reused forever) ──────────────────

static TS_IMPORT: Lazy<Regex> = Lazy::new(|| {
    // import type? { names } from 'path'
    // import * as ns from 'path'
    // import DefaultName from 'path'
    Regex::new(r#"(?m)^import\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+(?:\s*,\s*\{[^}]*\})?)\s+from\s+['"]([^'"]+)['"]"#).unwrap()
});

static TS_REQUIRE: Lazy<Regex> = Lazy::new(|| {
    // const x = require('./path')  or  require('./path')
    Regex::new(r#"require\(['"]([^'"]+)['"]\)"#).unwrap()
});

static TS_EXPORT_DECL: Lazy<Regex> = Lazy::new(|| {
    // export [default] function|class|const|let|var|type|interface|enum NAME
    Regex::new(r"(?m)^export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|type|interface|enum)\s+(\w+)").unwrap()
});

static TS_EXPORT_LIST: Lazy<Regex> = Lazy::new(|| {
    // export { foo, bar as baz }
    Regex::new(r"(?m)^export\s+\{([^}]+)\}").unwrap()
});

static TS_EXPORT_DEFAULT: Lazy<Regex> = Lazy::new(|| {
    // export default ClassName or export default function
    Regex::new(r"(?m)^export\s+default\s+(?:function|class)\s+(\w+)").unwrap()
});

static PY_IMPORT: Lazy<Regex> = Lazy::new(|| {
    // from .module import x, y  /  from ..module import x  /  import module
    Regex::new(r"(?m)^(?:from\s+(\.+[\w./]*)\s+import|import\s+([\w.]+))").unwrap()
});

static PY_DEF: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?m)^(?:def|class)\s+(\w+)").unwrap()
});

static GO_IMPORT: Lazy<Regex> = Lazy::new(|| {
    // "github.com/user/repo/pkg"  (inside import block)
    Regex::new(r#""([./][\w./-]+)""#).unwrap()
});

static GO_FUNC: Lazy<Regex> = Lazy::new(|| {
    // func FuncName or func (recv) FuncName
    Regex::new(r"(?m)^func\s+(?:\([^)]+\)\s+)?([A-Z]\w*)\s*\(").unwrap()
});

static RUST_USE: Lazy<Regex> = Lazy::new(|| {
    // use crate::auth::login;  /  mod auth;
    Regex::new(r"(?m)^(?:use|mod)\s+([\w:]+)").unwrap()
});

static RUST_PUB_FN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?m)^pub(?:\s+(?:async|unsafe))?\s+fn\s+(\w+)").unwrap()
});

static RUST_PUB_STRUCT: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?m)^pub\s+(?:struct|enum|trait|type)\s+(\w+)").unwrap()
});

// ── Public API ────────────────────────────────────────────────────────────────

pub fn analyze_file(file_path: &str) -> FileAnalysis {
    let ext = Path::new(file_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    let language = language_from_ext(ext);

    let content = match fs::read_to_string(file_path) {
        Ok(c) if c.len() <= 512 * 1024 => c, // skip files > 512KB
        _ => return FileAnalysis { file_path: file_path.to_string(), language: language.to_string(), symbols: vec![], imports: vec![] },
    };

    let (symbols, imports) = match ext {
        "ts" | "tsx" | "js" | "jsx" | "mjs" | "cjs" => extract_js_ts(&content),
        "py" => extract_python(&content),
        "go" => extract_go(&content),
        "rs" => extract_rust(&content),
        _ => (vec![], vec![]),
    };

    FileAnalysis { file_path: file_path.to_string(), language: language.to_string(), symbols, imports }
}

// ── TypeScript / JavaScript ───────────────────────────────────────────────────

fn extract_js_ts(src: &str) -> (Vec<ExtractedSymbol>, Vec<ExtractedImport>) {
    let mut symbols = Vec::new();
    let mut imports = Vec::new();

    // Imports: import { x } from './path'
    for cap in TS_IMPORT.captures_iter(src) {
        let path = cap[1].to_string();
        imports.push(ExtractedImport { path, names: vec![], is_type_only: false });
    }

    // Require calls
    for cap in TS_REQUIRE.captures_iter(src) {
        let path = cap[1].to_string();
        imports.push(ExtractedImport { path, names: vec![], is_type_only: false });
    }

    // Export declarations: export function foo / export class Foo
    for cap in TS_EXPORT_DECL.captures_iter(src) {
        let name = cap[1].to_string();
        let line = line_of(src, cap.get(0).unwrap().start());
        let kind = infer_js_kind(src, cap.get(0).unwrap().start());
        symbols.push(ExtractedSymbol { name, kind, line, is_exported: true });
    }

    // export default function/class NAME
    for cap in TS_EXPORT_DEFAULT.captures_iter(src) {
        let name = cap[1].to_string();
        let line = line_of(src, cap.get(0).unwrap().start());
        let kind = if src[cap.get(0).unwrap().start()..].contains("class") { NodeKind::Class } else { NodeKind::Function };
        symbols.push(ExtractedSymbol { name, kind, line, is_exported: true });
    }

    // export { foo, bar as baz } — these are re-exports of existing symbols
    for cap in TS_EXPORT_LIST.captures_iter(src) {
        for name in cap[1].split(',') {
            let name = name.split("as").next().unwrap_or("").trim().to_string();
            if !name.is_empty() && name != "default" {
                let line = line_of(src, cap.get(0).unwrap().start());
                symbols.push(ExtractedSymbol { name, kind: NodeKind::Variable, line, is_exported: true });
            }
        }
    }

    // Dedup symbols by name
    symbols.dedup_by(|a, b| a.name == b.name && { a.is_exported |= b.is_exported; false });
    // Dedup imports by path
    imports.dedup_by_key(|i| i.path.clone());

    (symbols, imports)
}

fn infer_js_kind(src: &str, offset: usize) -> NodeKind {
    let slice = &src[offset..std::cmp::min(offset + 50, src.len())];
    if slice.contains("class") { NodeKind::Class }
    else if slice.contains("interface") { NodeKind::Interface }
    else if slice.contains("enum") { NodeKind::Enum }
    else if slice.contains("type ") { NodeKind::Type }
    else if slice.contains("const") || slice.contains("let") || slice.contains("var") { NodeKind::Variable }
    else { NodeKind::Function }
}

// ── Python ────────────────────────────────────────────────────────────────────

fn extract_python(src: &str) -> (Vec<ExtractedSymbol>, Vec<ExtractedImport>) {
    let mut symbols = Vec::new();
    let mut imports = Vec::new();

    for cap in PY_IMPORT.captures_iter(src) {
        let path = cap.get(1).or_else(|| cap.get(2))
            .map(|m| m.as_str().to_string())
            .unwrap_or_default();
        if !path.is_empty() {
            imports.push(ExtractedImport { path, names: vec![], is_type_only: false });
        }
    }

    for cap in PY_DEF.captures_iter(src) {
        let name = cap[1].to_string();
        let line = line_of(src, cap.get(0).unwrap().start());
        let is_class = src[cap.get(0).unwrap().start()..cap.get(0).unwrap().start() + 5].starts_with("class");
        let kind = if is_class { NodeKind::Class } else { NodeKind::Function };
        // Python: public if not starting with _
        let is_exported = !name.starts_with('_');
        symbols.push(ExtractedSymbol { name, kind, line, is_exported });
    }

    (symbols, imports)
}

// ── Go ────────────────────────────────────────────────────────────────────────

fn extract_go(src: &str) -> (Vec<ExtractedSymbol>, Vec<ExtractedImport>) {
    let mut symbols = Vec::new();
    let mut imports = Vec::new();

    for cap in GO_IMPORT.captures_iter(src) {
        let path = cap[1].to_string();
        // Only relative paths are intra-workspace
        if path.starts_with('.') {
            imports.push(ExtractedImport { path, names: vec![], is_type_only: false });
        }
    }

    for cap in GO_FUNC.captures_iter(src) {
        let name = cap[1].to_string();
        let line = line_of(src, cap.get(0).unwrap().start());
        // Go: exported if starts with uppercase
        let is_exported = name.chars().next().map(|c| c.is_uppercase()).unwrap_or(false);
        symbols.push(ExtractedSymbol { name, kind: NodeKind::Function, line, is_exported });
    }

    (symbols, imports)
}

// ── Rust ──────────────────────────────────────────────────────────────────────

fn extract_rust(src: &str) -> (Vec<ExtractedSymbol>, Vec<ExtractedImport>) {
    let mut symbols = Vec::new();
    let mut imports = Vec::new();

    for cap in RUST_USE.captures_iter(src) {
        let path = cap[1].to_string();
        // Only crate-relative or super:: paths are intra-workspace
        if path.starts_with("crate::") || path.starts_with("super::") {
            imports.push(ExtractedImport { path, names: vec![], is_type_only: false });
        }
    }

    for cap in RUST_PUB_FN.captures_iter(src) {
        let name = cap[1].to_string();
        let line = line_of(src, cap.get(0).unwrap().start());
        symbols.push(ExtractedSymbol { name, kind: NodeKind::Function, line, is_exported: true });
    }

    for cap in RUST_PUB_STRUCT.captures_iter(src) {
        let name = cap[1].to_string();
        let line = line_of(src, cap.get(0).unwrap().start());
        let kind = if src[cap.get(0).unwrap().start()..].starts_with("pub enum") { NodeKind::Enum }
                   else if src[cap.get(0).unwrap().start()..].starts_with("pub trait") { NodeKind::Interface }
                   else if src[cap.get(0).unwrap().start()..].starts_with("pub type") { NodeKind::Type }
                   else { NodeKind::Class };
        symbols.push(ExtractedSymbol { name, kind, line, is_exported: true });
    }

    (symbols, imports)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn line_of(src: &str, byte_offset: usize) -> u32 {
    src[..byte_offset.min(src.len())].chars().filter(|&c| c == '\n').count() as u32 + 1
}

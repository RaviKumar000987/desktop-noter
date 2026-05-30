/// Call site extraction — TypeScript/JavaScript first (Phase 2.1 MVP).
///
/// Strategy: regex-based extraction of call sites from source text.
/// Tree-sitter would be more accurate but requires grammar compilation.
/// Regex covers 95% of real-world TS patterns at much lower complexity cost.
///
/// Language priority: TypeScript → JavaScript → Rust → Python → Go
use once_cell::sync::Lazy;
use regex::Regex;
use std::path::Path;

#[derive(Debug, Clone)]
pub struct RawCallSite {
    pub caller_name: String,    // name of the function that contains this call
    pub callee_name: String,    // raw name being called (may be "obj.method")
    pub line:        u32,
    pub col:         u32,
    pub is_async:    bool,
}

// ── TypeScript / JavaScript patterns ─────────────────────────────────────────

// Matches: function foo(...) { ... }  or  async function foo(...)
static RE_FN_DECL: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?m)^[ \t]*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*[(<]").unwrap()
});

// Matches: const/let foo = (...) =>  or  foo = async (...) =>
static RE_ARROW_FN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?m)(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(").unwrap()
});

// Matches: foo(...) or obj.method(...) calls — keyword filtering done in post-processing
static RE_CALL: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?m)\b(\w+(?:\.\w+)*)\s*\(").unwrap()
});

// Matches: new Foo(...)  constructor calls
static RE_NEW: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?m)\bnew\s+(\w+(?:\.\w+)*)\s*\(").unwrap()
});

// Matches: await foo(...)
static RE_AWAIT_CALL: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?m)\bawait\s+(\w+(?:\.\w+)*)\s*\(").unwrap()
});

// ── Rust patterns (Phase 2.1 future) ─────────────────────────────────────────
// Placeholder — not active in MVP

// ── Public API ────────────────────────────────────────────────────────────────

/// Detect language from file extension.
pub enum Language { TypeScript, JavaScript, Rust, Python, Go, Unknown }

pub fn detect_language(path: &Path) -> Language {
    match path.extension().and_then(|e| e.to_str()).unwrap_or("") {
        "ts" | "tsx"  => Language::TypeScript,
        "js" | "jsx" | "mjs" | "cjs" => Language::JavaScript,
        "rs"          => Language::Rust,
        "py"          => Language::Python,
        "go"          => Language::Go,
        _             => Language::Unknown,
    }
}

/// Extract raw call sites from a source file's text.
/// Returns list of (caller_name, callee_name, line, col, is_async).
pub fn extract_call_sites(source: &str, path: &Path) -> Vec<RawCallSite> {
    match detect_language(path) {
        Language::TypeScript | Language::JavaScript => extract_ts_js(source),
        Language::Rust   => extract_rust(source),
        Language::Python => extract_python(source),
        _                => vec![],
    }
}

// ── TypeScript / JavaScript extractor ────────────────────────────────────────

fn extract_ts_js(source: &str) -> Vec<RawCallSite> {
    let lines: Vec<&str> = source.lines().collect();
    let mut sites = Vec::new();

    // Step 1: find all function definitions and their line ranges
    let fn_ranges = collect_function_ranges(source, &lines);

    // Step 2: for each function definition, find call sites within its body
    for (fn_name, fn_start_line, fn_end_line) in &fn_ranges {
        let body_slice: Vec<&str> = lines
            .iter()
            .skip(*fn_start_line)
            .take(fn_end_line.saturating_sub(*fn_start_line))
            .copied()
            .collect();

        let body_text = body_slice.join("\n");

        // Regular calls
        for m in RE_CALL.captures_iter(&body_text) {
            let callee = m[1].to_string();
            if is_builtin_or_keyword(&callee) { continue; }
            let (line, col) = offset_to_line_col(&body_text, m.get(0).unwrap().start());
            sites.push(RawCallSite {
                caller_name: fn_name.clone(),
                callee_name: callee,
                line: (*fn_start_line + line) as u32,
                col: col as u32,
                is_async: false,
            });
        }

        // Await calls
        for m in RE_AWAIT_CALL.captures_iter(&body_text) {
            let callee = m[1].to_string();
            if is_builtin_or_keyword(&callee) { continue; }
            let (line, col) = offset_to_line_col(&body_text, m.get(0).unwrap().start());
            sites.push(RawCallSite {
                caller_name: fn_name.clone(),
                callee_name: callee,
                line: (*fn_start_line + line) as u32,
                col: col as u32,
                is_async: true,
            });
        }

        // Constructor calls
        for m in RE_NEW.captures_iter(&body_text) {
            let callee = format!("new {}", &m[1]);
            let (line, col) = offset_to_line_col(&body_text, m.get(0).unwrap().start());
            sites.push(RawCallSite {
                caller_name: fn_name.clone(),
                callee_name: callee,
                line: (*fn_start_line + line) as u32,
                col: col as u32,
                is_async: false,
            });
        }
    }

    // Deduplicate by (caller, callee, line)
    sites.sort_by(|a, b| a.line.cmp(&b.line));
    sites.dedup_by(|a, b| a.caller_name == b.caller_name && a.callee_name == b.callee_name && a.line == b.line);
    sites
}

/// Find all function definition names and their approximate line ranges.
/// Returns Vec<(name, start_line, end_line)>.
fn collect_function_ranges(source: &str, lines: &[&str]) -> Vec<(String, usize, usize)> {
    let mut ranges = Vec::new();
    let total = lines.len();

    // Named function declarations
    for m in RE_FN_DECL.captures_iter(source) {
        let name = m[1].to_string();
        let offset = m.get(0).unwrap().start();
        let (start_line, _) = offset_to_line_col(source, offset);
        let end_line = find_block_end(lines, start_line).unwrap_or(total);
        ranges.push((name, start_line, end_line));
    }

    // Arrow functions / method assignments
    for m in RE_ARROW_FN.captures_iter(source) {
        let name = m[1].to_string();
        let offset = m.get(0).unwrap().start();
        let (start_line, _) = offset_to_line_col(source, offset);
        let end_line = find_block_end(lines, start_line).unwrap_or(total);
        // avoid duplicates with fn decl names
        if !ranges.iter().any(|(n, s, _)| n == &name && *s == start_line) {
            ranges.push((name, start_line, end_line));
        }
    }

    ranges
}

/// Walk forward from `start` to find the matching `}` for the function block.
fn find_block_end(lines: &[&str], start: usize) -> Option<usize> {
    let mut depth = 0i32;
    let mut found_open = false;
    for (i, line) in lines.iter().enumerate().skip(start) {
        for ch in line.chars() {
            match ch {
                '{' => { depth += 1; found_open = true; }
                '}' => { depth -= 1; }
                _   => {}
            }
        }
        if found_open && depth <= 0 { return Some(i + 1); }
    }
    None
}

/// Convert a byte offset to (line_index, col_index) — both 0-based.
fn offset_to_line_col(text: &str, offset: usize) -> (usize, usize) {
    let before = &text[..offset.min(text.len())];
    let line = before.chars().filter(|&c| c == '\n').count();
    let col = before.rfind('\n').map(|p| offset - p - 1).unwrap_or(offset);
    (line, col)
}

fn is_builtin_or_keyword(name: &str) -> bool {
    // Control flow keywords (can appear before `(` — e.g. `if (`, `while (`)
    let keywords = [
        "if", "while", "for", "switch", "catch", "return", "typeof",
        "instanceof", "in", "of", "do", "else", "case", "default",
        "throw", "new", "delete", "void", "await", "yield",
    ];
    // Strip method prefix: obj.method → method
    let bare = name.rsplit('.').next().unwrap_or(name);
    if keywords.contains(&bare) { return true; }
    matches!(bare,
        "console" | "log" | "error" | "warn" | "info" | "debug"
        | "Math" | "JSON" | "Object" | "Array" | "String" | "Number"
        | "Boolean" | "Promise" | "Symbol" | "Map" | "Set" | "WeakMap"
        | "parseInt" | "parseFloat" | "isNaN" | "isFinite"
        | "setTimeout" | "setInterval" | "clearTimeout" | "clearInterval"
        | "require" | "import" | "exports"
        | "push" | "pop" | "shift" | "unshift" | "splice" | "slice"
        | "map" | "filter" | "reduce" | "forEach" | "find" | "findIndex"
        | "join" | "split" | "replace" | "includes" | "indexOf"
        | "toString" | "valueOf" | "hasOwnProperty"
        | "length" | "keys" | "values" | "entries" | "assign" | "create"
    )
}

// ── Rust extractor (future — not active in MVP) ───────────────────────────────

fn extract_rust(_source: &str) -> Vec<RawCallSite> {
    // TODO Phase 2.1 Post-MVP: parse fn items and call expressions
    vec![]
}

// ── Python extractor (future) ─────────────────────────────────────────────────

fn extract_python(_source: &str) -> Vec<RawCallSite> {
    // TODO Phase 2.1 Post-MVP
    vec![]
}

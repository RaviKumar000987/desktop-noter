/// Context Builder — assembles top-N ranked symbols into AiContext.
/// Reads ±20 lines of source around each symbol for code snippets.
use std::fs;
use std::time::Instant;
use anyhow::Result;
use tracing::info;

use crate::models::{AiContext, FileSnippet, ProjectSummary, RankedSymbol};

const SNIPPET_RADIUS: u32 = 20; // lines before and after symbol definition
const MAX_SNIPPETS: usize  = 8; // max files to include snippets from
const TOKENS_PER_LINE: usize = 8; // rough token estimate per code line

pub fn build(
    query: &str,
    ranked: Vec<RankedSymbol>,
    project: ProjectSummary,
) -> Result<AiContext> {
    let start = Instant::now();

    // Read file snippets for top symbols (deduplicate by file)
    let mut snippets: Vec<FileSnippet> = Vec::new();
    let mut seen_files = std::collections::HashSet::new();

    for ranked_sym in ranked.iter().take(MAX_SNIPPETS * 2) {
        let file = &ranked_sym.symbol.file;
        if seen_files.contains(file) { continue; }
        seen_files.insert(file.clone());

        if let Some(snippet) = read_snippet(file, ranked_sym.symbol.line, &ranked_sym.symbol.name) {
            snippets.push(snippet);
        }
        if snippets.len() >= MAX_SNIPPETS { break; }
    }

    // Token estimate: project summary ~100 + each symbol ~10 + each snippet line ~8
    let symbol_tokens = ranked.len() * 10;
    let snippet_tokens: usize = snippets.iter()
        .map(|s| s.content.lines().count() * TOKENS_PER_LINE)
        .sum();
    let token_estimate = 200 + symbol_tokens + snippet_tokens;

    let symbol_count = ranked.len();
    let build_time_ms = start.elapsed().as_millis() as u64;

    info!(
        "ai-context: built context for {:?} — {} symbols, {} snippets, ~{} tokens, {}ms",
        query, symbol_count, snippets.len(), token_estimate, build_time_ms
    );

    Ok(AiContext {
        query: query.to_string(),
        project,
        ranked_symbols: ranked,
        file_snippets: snippets,
        build_time_ms,
        symbol_count,
        token_estimate,
    })
}

/// Read ±SNIPPET_RADIUS lines around `line` from `file`.
fn read_snippet(file: &str, line: u32, symbol_name: &str) -> Option<FileSnippet> {
    let content = fs::read_to_string(file).ok()?;
    let lines: Vec<&str> = content.lines().collect();
    let total = lines.len() as u32;

    let start = line.saturating_sub(SNIPPET_RADIUS + 1).max(0);
    let end   = (line + SNIPPET_RADIUS).min(total);

    let snippet_lines: Vec<&str> = lines
        .iter()
        .skip(start as usize)
        .take((end - start) as usize)
        .copied()
        .collect();

    let language = language_from_ext(file);

    Some(FileSnippet {
        file:        file.to_string(),
        language,
        start_line:  start + 1,
        end_line:    end,
        content:     snippet_lines.join("\n"),
        symbol_name: Some(symbol_name.to_string()),
    })
}

fn language_from_ext(file: &str) -> String {
    let ext = std::path::Path::new(file)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    match ext {
        "ts" | "tsx"         => "typescript",
        "js" | "jsx" | "mjs" => "javascript",
        "rs"                 => "rust",
        "py"                 => "python",
        "go"                 => "go",
        "java"               => "java",
        "css" | "scss"       => "css",
        "html"               => "html",
        _                    => "text",
    }.to_string()
}

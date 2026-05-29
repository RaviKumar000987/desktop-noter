use napi_derive::napi;
use napi::bindgen_prelude::*;
use noter_search::SearchEngine;

#[napi(object)]
pub struct JsSearchResult {
    pub file: String,
    pub line: u32,
    pub column: u32,
    pub text: String,
    pub match_start: u32,
    pub match_end: u32,
}

/// Search all files under `root` for `pattern`.
/// Returns results sorted by file path.
#[napi]
pub fn search_workspace(
    root: String,
    pattern: String,
    case_sensitive: bool,
) -> Result<Vec<JsSearchResult>> {
    let engine = SearchEngine::new();
    let results = engine
        .search(&root, &pattern, case_sensitive)
        .map_err(|e| Error::from_reason(e.to_string()))?;

    let mut out: Vec<JsSearchResult> = results
        .into_iter()
        .map(|r| JsSearchResult {
            file: r.file,
            line: r.line,
            column: r.column,
            text: r.text,
            match_start: r.match_start as u32,
            match_end: r.match_end as u32,
        })
        .collect();

    out.sort_by(|a, b| a.file.cmp(&b.file));
    Ok(out)
}

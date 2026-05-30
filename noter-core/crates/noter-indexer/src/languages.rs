use tree_sitter::Language;

/// Returns true if this file extension is supported by the indexer.
/// Used by noter-index-engine to filter files before hashing.
pub fn is_indexable_ext(ext: &str) -> bool {
    get_language(ext).is_some()
}

pub fn get_language(ext: &str) -> Option<Language> {
    match ext {
        "js" | "jsx" | "mjs" | "cjs" => Some(tree_sitter_javascript::language()),
        "ts" | "tsx"                  => Some(tree_sitter_typescript::language_typescript()),
        "py"                          => Some(tree_sitter_python::language()),
        "rs"                          => Some(tree_sitter_rust::language()),
        "html" | "htm"               => Some(tree_sitter_html::language()),
        "css" | "scss"               => Some(tree_sitter_css::language()),
        _                             => None,
    }
}

use tree_sitter::{Parser, Tree};
use anyhow::Result;

pub struct TreeParser {
    parser: Parser,
}

impl TreeParser {
    pub fn for_language(ext: &str) -> Result<Self> {
        let mut parser = Parser::new();
        let lang = noter_indexer_lang(ext)?;
        parser.set_language(&lang)?;
        Ok(Self { parser })
    }

    pub fn parse(&mut self, source: &str, old_tree: Option<&Tree>) -> Option<Tree> {
        self.parser.parse(source, old_tree)
    }
}

fn noter_indexer_lang(ext: &str) -> Result<tree_sitter::Language> {
    match ext {
        "js" | "jsx" | "mjs" => Ok(tree_sitter_javascript::language()),
        "ts"                  => Ok(tree_sitter_typescript::language_typescript()),
        "tsx"                 => Ok(tree_sitter_typescript::language_tsx()),
        "py"                  => Ok(tree_sitter_python::language()),
        "rs"                  => Ok(tree_sitter_rust::language()),
        "html" | "htm"       => Ok(tree_sitter_html::language()),
        "css"                 => Ok(tree_sitter_css::language()),
        "go"                  => Ok(tree_sitter_go::language()),
        "java"                => Ok(tree_sitter_java::language()),
        "c"                   => Ok(tree_sitter_c::language()),
        "cpp" | "cc" | "cxx" => Ok(tree_sitter_cpp::language()),
        ext => anyhow::bail!("Unsupported language: {ext}"),
    }
}

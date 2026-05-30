pub mod query_parser;
pub mod symbol_search;

use anyhow::Result;
use crate::models::ContextSymbol;

/// High-level retrieval: parse query + search all sources.
pub fn retrieve(
    query: &str,
    symbol_db_path: &str,
    _workspace_root: &str,
) -> Result<Vec<ContextSymbol>> {
    let keywords = query_parser::parse(query);
    let symbols = symbol_search::search(&keywords, symbol_db_path, 60)?;
    Ok(symbols)
}

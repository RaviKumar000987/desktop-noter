use napi_derive::napi;
use napi::bindgen_prelude::*;
use noter_symboldb::SymbolDB;
use noter_indexer::WorkspaceIndexer;

#[napi(object)]
pub struct JsSymbol {
    pub name: String,
    pub kind: String,
    pub file: String,
    pub line: u32,
    pub column: u32,
    pub container: Option<String>,
}

/// Index all files in `root` and save to SQLite at `db_path`.
#[napi]
pub fn index_workspace(root: String, db_path: String) -> Result<u32> {
    let indexer = WorkspaceIndexer::new();
    let symbols = indexer
        .index_workspace(&root)
        .map_err(|e| Error::from_reason(e.to_string()))?;

    let count = symbols.len() as u32;

    let mut db = SymbolDB::open(&db_path)
        .map_err(|e| Error::from_reason(e.to_string()))?;
    db.insert_batch(&symbols)
        .map_err(|e| Error::from_reason(e.to_string()))?;

    Ok(count)
}

/// Search symbols by name prefix — used for Ctrl+P / Go-to-Symbol.
#[napi]
pub fn search_symbols(db_path: String, query: String) -> Result<Vec<JsSymbol>> {
    let db = SymbolDB::open(&db_path)
        .map_err(|e| Error::from_reason(e.to_string()))?;

    let symbols = db.search(&query)
        .map_err(|e| Error::from_reason(e.to_string()))?;

    Ok(symbols
        .into_iter()
        .map(|s| JsSymbol {
            name: s.name,
            kind: format!("{:?}", s.kind),
            file: s.file,
            line: s.line,
            column: s.column,
            container: s.container,
        })
        .collect())
}

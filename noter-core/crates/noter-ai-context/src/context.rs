use anyhow::Result;
use noter_symboldb::SymbolDB;
use noter_graph::WorkspaceGraph;

use crate::snapshot::ContextSnapshot;

pub struct AiContextEngine {
    pub symbol_db: SymbolDB,
    pub graph: WorkspaceGraph,
}

impl AiContextEngine {
    pub fn new(db_path: &str) -> Result<Self> {
        Ok(Self {
            symbol_db: SymbolDB::open(db_path)?,
            graph: WorkspaceGraph::new(),
        })
    }

    pub fn context_for(&self, file: &str, symbol_name: &str) -> Result<ContextSnapshot> {
        let related_symbols = self.symbol_db.search(symbol_name)?;
        let callers = self.graph.references_to(symbol_name);

        Ok(ContextSnapshot {
            open_file: file.to_string(),
            cursor_symbol: related_symbols.first().cloned(),
            related_symbols,
            file_imports: vec![],
            callers,
            recent_edits: vec![],
        })
    }
}

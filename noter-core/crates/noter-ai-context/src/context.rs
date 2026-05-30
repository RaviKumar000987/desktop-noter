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
        let cursor_symbol = related_symbols.first().cloned();

        // Resolve callers via SymbolId from the graph.
        // Phase 2 will replace UUID strings with readable names via an ID→Symbol DB lookup.
        let callers = cursor_symbol
            .as_ref()
            .map(|s| {
                self.graph
                    .references_to(&s.id)
                    .into_iter()
                    .map(|id| id.to_string())
                    .collect()
            })
            .unwrap_or_default();

        Ok(ContextSnapshot {
            open_file: file.to_string(),
            cursor_symbol,
            related_symbols,
            file_imports: vec![],
            callers,
            recent_edits: vec![],
        })
    }
}

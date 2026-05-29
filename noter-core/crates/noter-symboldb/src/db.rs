use rusqlite::{Connection, params};
use anyhow::Result;
use noter_indexer::Symbol;

pub struct SymbolDB {
    conn: Connection,
}

impl SymbolDB {
    pub fn open(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;
        let db = Self { conn };
        db.init_schema()?;
        Ok(db)
    }

    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        let db = Self { conn };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> Result<()> {
        self.conn.execute_batch("
            CREATE TABLE IF NOT EXISTS symbols (
                id      INTEGER PRIMARY KEY,
                name    TEXT NOT NULL,
                kind    TEXT NOT NULL,
                file    TEXT NOT NULL,
                line    INTEGER NOT NULL,
                col     INTEGER NOT NULL,
                container TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_name ON symbols(name);
            CREATE INDEX IF NOT EXISTS idx_file ON symbols(file);
        ")?;
        Ok(())
    }

    pub fn insert_batch(&mut self, symbols: &[Symbol]) -> Result<()> {
        let tx = self.conn.transaction()?;
        for s in symbols {
            tx.execute(
                "INSERT OR REPLACE INTO symbols (name, kind, file, line, col, container)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    s.name,
                    format!("{:?}", s.kind),
                    s.file,
                    s.line,
                    s.column,
                    s.container
                ],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn search(&self, query: &str) -> Result<Vec<Symbol>> {
        let pattern = format!("%{query}%");
        let mut stmt = self.conn.prepare(
            "SELECT name, kind, file, line, col, container FROM symbols WHERE name LIKE ?1 LIMIT 100"
        )?;
        let rows = stmt.query_map(params![pattern], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, u32>(3)?,
                row.get::<_, u32>(4)?,
                row.get::<_, Option<String>>(5)?,
            ))
        })?;

        let mut results = Vec::new();
        for row in rows {
            let (name, kind_str, file, line, col, container) = row?;
            results.push(Symbol {
                name,
                kind: parse_kind(&kind_str),
                file,
                line,
                column: col,
                container,
            });
        }
        Ok(results)
    }
}

fn parse_kind(s: &str) -> noter_indexer::SymbolKind {
    use noter_indexer::SymbolKind::*;
    match s {
        "Function"  => Function,
        "Class"     => Class,
        "Method"    => Method,
        "Variable"  => Variable,
        "Constant"  => Constant,
        "Interface" => Interface,
        "Enum"      => Enum,
        "Import"    => Import,
        "Export"    => Export,
        _           => Function,
    }
}

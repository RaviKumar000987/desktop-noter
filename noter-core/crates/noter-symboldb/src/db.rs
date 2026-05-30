use rusqlite::{Connection, params};
use anyhow::Result;
use noter_core_api::{Symbol, SymbolId, SymbolKind, FileRef, Range, Position};

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
                id        TEXT PRIMARY KEY,
                name      TEXT NOT NULL,
                kind      TEXT NOT NULL,
                file_uri  TEXT NOT NULL,
                file_rel  TEXT NOT NULL,
                line      INTEGER NOT NULL,
                col       INTEGER NOT NULL,
                container TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_name ON symbols(name);
            CREATE INDEX IF NOT EXISTS idx_file ON symbols(file_uri);
        ")?;
        Ok(())
    }

    pub fn insert_batch(&mut self, symbols: &[Symbol]) -> Result<()> {
        let tx = self.conn.transaction()?;
        for s in symbols {
            tx.execute(
                "INSERT OR REPLACE INTO symbols (id, name, kind, file_uri, file_rel, line, col, container)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    s.id.to_string(),
                    s.name,
                    format!("{:?}", s.kind),
                    s.file.uri,
                    s.file.workspace_relative,
                    s.range.start.line,
                    s.range.start.character,
                    s.container
                ],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn delete_file(&mut self, file_uri: &str) -> Result<()> {
        self.conn.execute("DELETE FROM symbols WHERE file_uri = ?1", params![file_uri])?;
        Ok(())
    }

    pub fn search(&self, query: &str) -> Result<Vec<Symbol>> {
        let pattern = format!("%{query}%");
        let mut stmt = self.conn.prepare(
            "SELECT id, name, kind, file_uri, file_rel, line, col, container
             FROM symbols WHERE name LIKE ?1 LIMIT 100"
        )?;
        let rows = stmt.query_map(params![pattern], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, u32>(5)?,
                row.get::<_, u32>(6)?,
                row.get::<_, Option<String>>(7)?,
            ))
        })?;

        let mut results = Vec::new();
        for row in rows {
            let (id_str, name, kind_str, file_uri, file_rel, line, col, container) = row?;
            let file = FileRef { uri: file_uri, workspace_relative: file_rel };
            let pos = Position { line, character: col };
            let range = Range { start: pos, end: pos };
            let mut symbol = Symbol::new(name, parse_kind(&kind_str), file, range, container);
            // Restore the exact UUID from DB instead of re-deriving it.
            if let Some(id) = SymbolId::from_str(&id_str) {
                symbol.id = id;
            }
            results.push(symbol);
        }
        Ok(results)
    }
}

fn parse_kind(s: &str) -> SymbolKind {
    match s {
        "Function"      => SymbolKind::Function,
        "Class"         => SymbolKind::Class,
        "Method"        => SymbolKind::Method,
        "Variable"      => SymbolKind::Variable,
        "Constant"      => SymbolKind::Constant,
        "Interface"     => SymbolKind::Interface,
        "Enum"          => SymbolKind::Enum,
        "EnumMember"    => SymbolKind::EnumMember,
        "Import"        => SymbolKind::Import,
        "Export"        => SymbolKind::Export,
        "Struct"        => SymbolKind::Struct,
        "Module"        => SymbolKind::Module,
        "Namespace"     => SymbolKind::Namespace,
        "Property"      => SymbolKind::Property,
        "Field"         => SymbolKind::Field,
        "Constructor"   => SymbolKind::Constructor,
        "TypeParameter" => SymbolKind::TypeParameter,
        _               => SymbolKind::Unknown,
    }
}

use std::fs;
use std::path::Path;
use anyhow::Result;
use crate::models::{DependencyNode, DepKind, Ecosystem, FrameworkInfo, FrameworkCategory};

pub fn parse(root: &Path) -> Result<Option<(Vec<DependencyNode>, Vec<FrameworkInfo>)>> {
    let go_mod = root.join("go.mod");
    if !go_mod.exists() { return Ok(None); }

    let text = fs::read_to_string(&go_mod)?;
    let mut deps = Vec::new();
    let mut frameworks = Vec::new();
    let mut in_require = false;

    for line in text.lines() {
        let line = line.trim();
        if line == "require (" { in_require = true; continue; }
        if line == ")" { in_require = false; continue; }

        let part = if in_require {
            line
        } else if line.starts_with("require ") {
            &line[8..]
        } else {
            continue
        };

        let indirect = part.contains("// indirect");
        let mut tokens = part.split_whitespace();
        if let (Some(module), Some(ver)) = (tokens.next(), tokens.next()) {
            detect_framework(module, &mut frameworks);
            deps.push(DependencyNode {
                name: module.to_string(),
                version: Some(ver.to_string()),
                kind: if indirect { DepKind::Peer } else { DepKind::Direct },
                ecosystem: Ecosystem::Go,
            });
        }
    }

    if deps.is_empty() { return Ok(None); }
    Ok(Some((deps, frameworks)))
}

fn detect_framework(module: &str, out: &mut Vec<FrameworkInfo>) {
    let (display, cat, conf): (&str, FrameworkCategory, u8) = match module {
        "github.com/gin-gonic/gin"               => ("Gin",        FrameworkCategory::Backend, 100),
        m if m.starts_with("github.com/gofiber/fiber") => ("Fiber", FrameworkCategory::Backend, 100),
        m if m.starts_with("github.com/labstack/echo") => ("Echo",  FrameworkCategory::Backend, 100),
        "github.com/gorilla/mux"                 => ("Gorilla Mux",FrameworkCategory::Backend, 100),
        m if m.starts_with("github.com/go-chi/chi") => ("Chi",     FrameworkCategory::Backend, 100),
        "gorm.io/gorm"                           => ("GORM",       FrameworkCategory::Orm,     100),
        "github.com/uptrace/bun"                 => ("Bun",        FrameworkCategory::Orm,     100),
        "github.com/lib/pq"                      => ("PostgreSQL", FrameworkCategory::Database, 80),
        "github.com/go-sql-driver/mysql"         => ("MySQL",      FrameworkCategory::Database, 80),
        "go.mongodb.org/mongo-driver"            => ("MongoDB",    FrameworkCategory::Database, 80),
        "github.com/redis/go-redis/v9"           => ("Redis",      FrameworkCategory::Database, 80),
        _ => return,
    };
    if !out.iter().any(|f: &FrameworkInfo| f.name == display) {
        out.push(FrameworkInfo { name: display.to_string(), version: None, confidence: conf, category: cat });
    }
}

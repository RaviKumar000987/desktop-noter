use std::fs;
use std::path::Path;
use anyhow::Result;
use crate::models::{DependencyNode, DepKind, Ecosystem, FrameworkInfo, FrameworkCategory};

pub fn parse(root: &Path) -> Result<Option<(Vec<DependencyNode>, Vec<FrameworkInfo>)>> {
    let toml_path = root.join("Cargo.toml");
    if !toml_path.exists() { return Ok(None); }

    let text = fs::read_to_string(&toml_path)?;
    let value: toml::Value = text.parse()?;
    let mut deps = Vec::new();
    let mut frameworks = Vec::new();

    parse_section(&value, "dependencies",     DepKind::Direct, &mut deps, &mut frameworks);
    parse_section(&value, "dev-dependencies", DepKind::Dev,    &mut deps, &mut frameworks);

    Ok(Some((deps, frameworks)))
}

fn parse_section(
    value: &toml::Value,
    key: &str,
    kind: DepKind,
    deps: &mut Vec<DependencyNode>,
    frameworks: &mut Vec<FrameworkInfo>,
) {
    if let Some(table) = value.get(key).and_then(|v| v.as_table()) {
        for (name, val) in table {
            let version = match val {
                toml::Value::String(s) => Some(s.clone()),
                toml::Value::Table(t) => t.get("version").and_then(|v| v.as_str()).map(|s| s.to_string()),
                _ => None,
            };
            detect_framework(name, frameworks);
            deps.push(DependencyNode {
                name: name.clone(),
                version,
                kind: kind.clone(),
                ecosystem: Ecosystem::Cargo,
            });
        }
    }
}

fn detect_framework(name: &str, out: &mut Vec<FrameworkInfo>) {
    let (display, cat, conf): (&str, FrameworkCategory, u8) = match name {
        "axum"                  => ("Axum",     FrameworkCategory::Backend, 100),
        "actix-web"             => ("Actix Web",FrameworkCategory::Backend, 100),
        "rocket"                => ("Rocket",   FrameworkCategory::Backend, 100),
        "warp"                  => ("Warp",     FrameworkCategory::Backend, 100),
        "poem"                  => ("Poem",     FrameworkCategory::Backend, 100),
        "salvo"                 => ("Salvo",    FrameworkCategory::Backend, 100),
        "tauri"                 => ("Tauri",    FrameworkCategory::Runtime, 100),
        "bevy"                  => ("Bevy",     FrameworkCategory::Ui,      100),
        "sqlx"                  => ("SQLx",     FrameworkCategory::Database, 100),
        "diesel"                => ("Diesel",   FrameworkCategory::Orm, 100),
        "sea-orm"               => ("SeaORM",   FrameworkCategory::Orm, 100),
        "tokio"                 => ("Tokio",    FrameworkCategory::Runtime, 90),
        "napi" | "napi-derive"  => ("NAPI-RS",  FrameworkCategory::Runtime, 100),
        _ => return,
    };
    if !out.iter().any(|f: &FrameworkInfo| f.name == display) {
        out.push(FrameworkInfo { name: display.to_string(), version: None, confidence: conf, category: cat });
    }
}

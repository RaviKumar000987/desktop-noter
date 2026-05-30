use std::fs;
use std::path::Path;
use anyhow::Result;
use crate::models::{DependencyNode, DepKind, Ecosystem, FrameworkInfo, FrameworkCategory};

pub fn parse(root: &Path) -> Result<Option<(Vec<DependencyNode>, Vec<FrameworkInfo>)>> {
    let req = root.join("requirements.txt");
    let pyproject = root.join("pyproject.toml");

    if req.exists() {
        return parse_requirements(&req);
    }
    if pyproject.exists() {
        return parse_pyproject(&pyproject);
    }
    Ok(None)
}

fn parse_requirements(path: &Path) -> Result<Option<(Vec<DependencyNode>, Vec<FrameworkInfo>)>> {
    let text = fs::read_to_string(path)?;
    let mut deps = Vec::new();
    let mut frameworks = Vec::new();

    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') { continue; }
        let (name, version) = split_requirement(line);
        detect_framework(&name, &mut frameworks);
        deps.push(DependencyNode { name, version, kind: DepKind::Direct, ecosystem: Ecosystem::Pip });
    }
    Ok(Some((deps, frameworks)))
}

fn parse_pyproject(path: &Path) -> Result<Option<(Vec<DependencyNode>, Vec<FrameworkInfo>)>> {
    let text = fs::read_to_string(path)?;
    let value: toml::Value = text.parse().unwrap_or(toml::Value::Table(Default::default()));
    let mut deps = Vec::new();
    let mut frameworks = Vec::new();

    if let Some(arr) = value.get("project").and_then(|p| p.get("dependencies")).and_then(|d| d.as_array()) {
        for item in arr {
            if let Some(s) = item.as_str() {
                let (name, version) = split_requirement(s);
                detect_framework(&name, &mut frameworks);
                deps.push(DependencyNode { name, version, kind: DepKind::Direct, ecosystem: Ecosystem::Pip });
            }
        }
    }
    if deps.is_empty() { return Ok(None); }
    Ok(Some((deps, frameworks)))
}

fn split_requirement(s: &str) -> (String, Option<String>) {
    if let Some(idx) = s.find(['>', '<', '=', '~', '!'].as_ref()) {
        (s[..idx].trim().to_string(), Some(s[idx..].trim().to_string()))
    } else {
        (s.trim().to_string(), None)
    }
}

fn detect_framework(name: &str, out: &mut Vec<FrameworkInfo>) {
    let lower = name.to_lowercase();
    let (display, cat, conf): (&str, FrameworkCategory, u8) = match lower.as_str() {
        "django"               => ("Django",      FrameworkCategory::Backend,  100),
        "flask"                => ("Flask",       FrameworkCategory::Backend,  100),
        "fastapi"              => ("FastAPI",      FrameworkCategory::Backend,  100),
        "tornado"              => ("Tornado",      FrameworkCategory::Backend,  100),
        "sanic"                => ("Sanic",        FrameworkCategory::Backend,  100),
        "starlette"            => ("Starlette",    FrameworkCategory::Backend,  100),
        "sqlalchemy"           => ("SQLAlchemy",   FrameworkCategory::Orm,      100),
        "alembic"              => ("Alembic",      FrameworkCategory::Database, 90),
        "psycopg2" | "psycopg2-binary" => ("PostgreSQL", FrameworkCategory::Database, 80),
        "pymysql" | "mysqlclient" => ("MySQL",    FrameworkCategory::Database, 80),
        "pymongo"              => ("MongoDB",      FrameworkCategory::Database, 80),
        "redis"                => ("Redis",        FrameworkCategory::Database, 80),
        "celery"               => ("Celery",       FrameworkCategory::Backend,  90),
        "pytest"               => ("Pytest",       FrameworkCategory::Testing,  100),
        "pydantic"             => ("Pydantic",     FrameworkCategory::Other,    90),
        _ => return,
    };
    if !out.iter().any(|f: &FrameworkInfo| f.name == display) {
        out.push(FrameworkInfo { name: display.to_string(), version: None, confidence: conf, category: cat });
    }
}

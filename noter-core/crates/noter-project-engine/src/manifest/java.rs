use std::fs;
use std::path::Path;
use anyhow::Result;
use crate::models::{DependencyNode, DepKind, Ecosystem, FrameworkInfo, FrameworkCategory};

pub fn parse(root: &Path) -> Result<Option<(Vec<DependencyNode>, Vec<FrameworkInfo>)>> {
    let pom = root.join("pom.xml");
    if pom.exists() { return parse_pom(&pom); }

    let gradle = root.join("build.gradle");
    if gradle.exists() { return parse_gradle(&gradle, Ecosystem::Gradle); }

    let gradle_kts = root.join("build.gradle.kts");
    if gradle_kts.exists() { return parse_gradle(&gradle_kts, Ecosystem::Gradle); }

    Ok(None)
}

fn parse_pom(path: &Path) -> Result<Option<(Vec<DependencyNode>, Vec<FrameworkInfo>)>> {
    let text = fs::read_to_string(path)?;
    let mut deps = Vec::new();
    let mut frameworks = Vec::new();
    let mut in_dep = false;
    let mut artifact = String::new();
    let mut version = String::new();

    for line in text.lines() {
        let t = line.trim();
        if t == "<dependency>" { in_dep = true; artifact.clear(); version.clear(); continue; }
        if t == "</dependency>" {
            if in_dep && !artifact.is_empty() {
                detect_framework(&artifact, &mut frameworks);
                deps.push(DependencyNode {
                    name: artifact.clone(),
                    version: if version.is_empty() { None } else { Some(version.clone()) },
                    kind: DepKind::Direct,
                    ecosystem: Ecosystem::Maven,
                });
            }
            in_dep = false;
        }
        if in_dep {
            if let Some(v) = xml_text(t, "artifactId") { artifact = v; }
            if let Some(v) = xml_text(t, "version")    { version = v; }
        }
    }
    if deps.is_empty() { return Ok(None); }
    Ok(Some((deps, frameworks)))
}

fn parse_gradle(path: &Path, ecosystem: Ecosystem) -> Result<Option<(Vec<DependencyNode>, Vec<FrameworkInfo>)>> {
    let text = fs::read_to_string(path)?;
    let mut deps = Vec::new();
    let mut frameworks = Vec::new();

    for line in text.lines() {
        let t = line.trim();
        let kind = if t.starts_with("testImplementation") || t.starts_with("testCompile") {
            DepKind::Dev
        } else if t.starts_with("implementation") || t.starts_with("api") || t.starts_with("compileOnly") {
            DepKind::Direct
        } else {
            continue
        };

        if let Some(coords) = extract_string_literal(t) {
            let parts: Vec<&str> = coords.splitn(3, ':').collect();
            if parts.len() >= 2 {
                let artifact = parts[1].to_string();
                let version = parts.get(2).map(|s| s.to_string());
                detect_framework(&artifact, &mut frameworks);
                deps.push(DependencyNode {
                    name: artifact,
                    version,
                    kind,
                    ecosystem: ecosystem.clone(),
                });
            }
        }
    }
    if deps.is_empty() { return Ok(None); }
    Ok(Some((deps, frameworks)))
}

fn xml_text(line: &str, tag: &str) -> Option<String> {
    let open = format!("<{}>", tag);
    let close = format!("</{}>", tag);
    if line.contains(&open) && line.contains(&close) {
        let s = line.find(&open)? + open.len();
        let e = line.find(&close)?;
        Some(line[s..e].to_string())
    } else {
        None
    }
}

fn extract_string_literal(line: &str) -> Option<String> {
    let s = line.find(|c| c == '\'' || c == '"')? + 1;
    let rest = &line[s..];
    let e = rest.find(|c| c == '\'' || c == '"')?;
    Some(rest[..e].to_string())
}

fn detect_framework(artifact: &str, out: &mut Vec<FrameworkInfo>) {
    let (display, cat, conf): (&str, FrameworkCategory, u8) = match artifact {
        "spring-boot-starter-web" | "spring-webmvc" => ("Spring Boot", FrameworkCategory::Backend, 100),
        "spring-boot-starter-data-jpa"              => ("Spring Data", FrameworkCategory::Orm,     100),
        "spring-boot-starter-security" | "spring-security-core" => ("Spring Security", FrameworkCategory::Auth, 100),
        "quarkus-core"   => ("Quarkus",   FrameworkCategory::Backend, 100),
        "micronaut-core" => ("Micronaut", FrameworkCategory::Backend, 100),
        "hibernate-core" => ("Hibernate", FrameworkCategory::Orm,     100),
        "postgresql"                           => ("PostgreSQL", FrameworkCategory::Database, 80),
        "mysql-connector-java" | "mysql-connector-j" => ("MySQL", FrameworkCategory::Database, 80),
        "h2"             => ("H2",        FrameworkCategory::Database, 80),
        "junit-jupiter" | "junit" => ("JUnit", FrameworkCategory::Testing, 100),
        _ => return,
    };
    if !out.iter().any(|f: &FrameworkInfo| f.name == display) {
        out.push(FrameworkInfo { name: display.to_string(), version: None, confidence: conf, category: cat });
    }
}

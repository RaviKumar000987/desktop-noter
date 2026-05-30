use std::collections::HashMap;
use std::fs;
use std::path::Path;
use anyhow::Result;
use serde::Deserialize;
use crate::models::{DependencyNode, DepKind, Ecosystem, FrameworkInfo, FrameworkCategory};

#[derive(Deserialize)]
struct PackageJson {
    dependencies:     Option<HashMap<String, String>>,
    #[serde(rename = "devDependencies")]
    dev_dependencies: Option<HashMap<String, String>>,
    #[serde(rename = "peerDependencies")]
    peer_dependencies: Option<HashMap<String, String>>,
}

pub fn parse(root: &Path) -> Result<Option<(Vec<DependencyNode>, Vec<FrameworkInfo>)>> {
    let pkg_path = root.join("package.json");
    if !pkg_path.exists() { return Ok(None); }

    let text = fs::read_to_string(&pkg_path)?;
    let pkg: PackageJson = serde_json::from_str(&text)?;
    let mut deps = Vec::new();
    let mut frameworks = Vec::new();

    if let Some(d) = &pkg.dependencies {
        for (name, ver) in d {
            let v = clean_semver(ver);
            detect_framework(name, &v, DepKind::Direct, &mut frameworks);
            deps.push(make_dep(name, v, DepKind::Direct));
        }
    }
    if let Some(d) = &pkg.dev_dependencies {
        for (name, ver) in d {
            let v = clean_semver(ver);
            detect_framework(name, &v, DepKind::Dev, &mut frameworks);
            deps.push(make_dep(name, v, DepKind::Dev));
        }
    }
    if let Some(d) = &pkg.peer_dependencies {
        for (name, ver) in d {
            deps.push(make_dep(name, clean_semver(ver), DepKind::Peer));
        }
    }

    Ok(Some((deps, frameworks)))
}

fn make_dep(name: &str, version: String, kind: DepKind) -> DependencyNode {
    DependencyNode { name: name.to_string(), version: Some(version), kind, ecosystem: Ecosystem::Npm }
}

fn clean_semver(v: &str) -> String {
    v.trim_start_matches(['^', '~', '>', '<', '=', ' '].as_ref()).to_string()
}

fn detect_framework(pkg: &str, ver: &str, _kind: DepKind, out: &mut Vec<FrameworkInfo>) {
    let (display, cat, conf): (&str, FrameworkCategory, u8) = match pkg {
        // UI
        "react" | "react-dom"   => ("React",    FrameworkCategory::Ui, 100),
        "vue" | "@vue/core"      => ("Vue",      FrameworkCategory::Ui, 100),
        "svelte"                 => ("Svelte",   FrameworkCategory::Ui, 100),
        "@angular/core"          => ("Angular",  FrameworkCategory::Ui, 100),
        "@solidjs/core"          => ("SolidJS",  FrameworkCategory::Ui, 100),
        // Meta-frameworks / full-stack
        "next"     => ("Next.js", FrameworkCategory::Backend, 100),
        "nuxt"     => ("Nuxt",    FrameworkCategory::Backend, 100),
        "remix"    => ("Remix",   FrameworkCategory::Backend, 100),
        "astro"    => ("Astro",   FrameworkCategory::Backend, 100),
        // Backend
        "express"        => ("Express",  FrameworkCategory::Backend, 100),
        "@nestjs/core"   => ("NestJS",   FrameworkCategory::Backend, 100),
        "fastify"        => ("Fastify",  FrameworkCategory::Backend, 100),
        "koa"            => ("Koa",      FrameworkCategory::Backend, 100),
        "hono"           => ("Hono",     FrameworkCategory::Backend, 100),
        "@hapi/hapi"     => ("Hapi",     FrameworkCategory::Backend, 100),
        // ORM
        "@prisma/client" => ("Prisma",     FrameworkCategory::Orm, 100),
        "typeorm"        => ("TypeORM",    FrameworkCategory::Orm, 100),
        "drizzle-orm"    => ("Drizzle",    FrameworkCategory::Orm, 100),
        "mongoose"       => ("Mongoose",   FrameworkCategory::Orm, 100),
        "sequelize"      => ("Sequelize",  FrameworkCategory::Orm, 100),
        // Database
        "pg" | "postgres"          => ("PostgreSQL", FrameworkCategory::Database, 80),
        "mysql2" | "mysql"         => ("MySQL",      FrameworkCategory::Database, 80),
        "mongodb"                  => ("MongoDB",    FrameworkCategory::Database, 80),
        "redis" | "ioredis"        => ("Redis",      FrameworkCategory::Database, 80),
        "sqlite3" | "better-sqlite3" => ("SQLite",   FrameworkCategory::Database, 80),
        // Build
        "vite"      => ("Vite",      FrameworkCategory::Build, 100),
        "webpack"   => ("Webpack",   FrameworkCategory::Build, 100),
        "rollup"    => ("Rollup",    FrameworkCategory::Build, 100),
        "parcel"    => ("Parcel",    FrameworkCategory::Build, 100),
        "esbuild"   => ("esbuild",   FrameworkCategory::Build, 100),
        "turbopack" => ("Turbopack", FrameworkCategory::Build, 100),
        // Runtime
        "electron"                          => ("Electron", FrameworkCategory::Runtime, 100),
        "@tauri-apps/api" | "tauri"         => ("Tauri",   FrameworkCategory::Runtime, 100),
        // Auth
        "jsonwebtoken"              => ("JWT",        FrameworkCategory::Auth, 90),
        "passport"                  => ("Passport.js",FrameworkCategory::Auth, 90),
        "next-auth" | "@auth/core"  => ("NextAuth",   FrameworkCategory::Auth, 100),
        "@clerk/nextjs" | "clerk"   => ("Clerk",      FrameworkCategory::Auth, 100),
        "lucia"                     => ("Lucia",      FrameworkCategory::Auth, 100),
        // Testing
        "jest"                => ("Jest",       FrameworkCategory::Testing, 100),
        "vitest"              => ("Vitest",     FrameworkCategory::Testing, 100),
        "mocha"               => ("Mocha",      FrameworkCategory::Testing, 100),
        "@playwright/test"    => ("Playwright", FrameworkCategory::Testing, 100),
        "cypress"             => ("Cypress",    FrameworkCategory::Testing, 100),
        _ => return,
    };

    if !out.iter().any(|f: &FrameworkInfo| f.name == display) {
        out.push(FrameworkInfo {
            name: display.to_string(),
            version: if ver.is_empty() { None } else { Some(ver.to_string()) },
            confidence: conf,
            category: cat,
        });
    }
}

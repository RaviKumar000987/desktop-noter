/// Layer 2 — source-scan framework detector.
/// Scans import statements in source files to find frameworks that aren't
/// declared in manifest files (e.g., implicit deps, mono-repos).
use std::fs;
use std::path::Path;
use walkdir::WalkDir;
use crate::models::{FrameworkInfo, FrameworkCategory};

const MAX_FILES: usize = 500;
const MAX_FILE_BYTES: u64 = 64 * 1024;
const SKIP_DIRS: &[&str] = &[
    "node_modules", ".git", "target", "dist", "build",
    ".next", "__pycache__", "vendor", ".cache", "coverage",
];
const SOURCE_EXTS: &[&str] = &["ts", "tsx", "js", "jsx", "py", "java", "go", "rs"];

pub fn scan(root: &Path, existing: &[FrameworkInfo]) -> Vec<FrameworkInfo> {
    let mut found: Vec<FrameworkInfo> = Vec::new();
    let mut count = 0usize;

    'walk: for entry in WalkDir::new(root).max_depth(6).follow_links(false).into_iter().flatten() {
        // Skip excluded directories
        if entry.file_type().is_dir() {
            let name = entry.file_name().to_string_lossy();
            if SKIP_DIRS.contains(&name.as_ref()) {
                // WalkDir doesn't support skipping dirs mid-walk without filter_entry,
                // but max_depth=6 + name check on the dir entry itself is sufficient here
            }
            continue;
        }

        let path = entry.path();
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        if !SOURCE_EXTS.contains(&ext) { continue; }
        if entry.metadata().map(|m| m.len()).unwrap_or(0) > MAX_FILE_BYTES { continue; }

        // Check no ancestor is a skip dir
        let is_skipped = path.components().any(|c| {
            SKIP_DIRS.contains(&c.as_os_str().to_string_lossy().as_ref())
        });
        if is_skipped { continue; }

        count += 1;
        if count > MAX_FILES { break 'walk; }

        if let Ok(text) = fs::read_to_string(path) {
            scan_source(&text, ext, existing, &mut found);
        }
    }

    found
}

fn add(name: &str, cat: FrameworkCategory, conf: u8, existing: &[FrameworkInfo], out: &mut Vec<FrameworkInfo>) {
    if !existing.iter().any(|f| f.name == name) && !out.iter().any(|f| f.name == name) {
        out.push(FrameworkInfo { name: name.to_string(), version: None, confidence: conf, category: cat });
    }
}

fn scan_source(text: &str, ext: &str, existing: &[FrameworkInfo], out: &mut Vec<FrameworkInfo>) {
    match ext {
        "ts" | "tsx" | "js" | "jsx" => scan_js(text, existing, out),
        "py"   => scan_py(text, existing, out),
        "go"   => scan_go(text, existing, out),
        "java" => scan_java(text, existing, out),
        "rs"   => scan_rs(text, existing, out),
        _ => {}
    }
}

fn scan_js(text: &str, ex: &[FrameworkInfo], out: &mut Vec<FrameworkInfo>) {
    macro_rules! detect {
        ($check:expr, $name:expr, $cat:expr, $conf:expr) => {
            if $check { add($name, $cat, $conf, ex, out); }
        };
    }
    detect!(text.contains("from \"react\"") || text.contains("from 'react'"),       "React",    FrameworkCategory::Ui,      95);
    detect!(text.contains("from \"vue\"")   || text.contains("from 'vue'"),          "Vue",      FrameworkCategory::Ui,      95);
    detect!(text.contains("from 'svelte'")  || text.contains("from \"svelte\""),     "Svelte",   FrameworkCategory::Ui,      95);
    detect!(text.contains("from \"next/")   || text.contains("from 'next/"),         "Next.js",  FrameworkCategory::Backend, 95);
    detect!(text.contains("from \"express\"") || text.contains("require('express')"), "Express", FrameworkCategory::Backend, 95);
    detect!(text.contains("@nestjs/"),                                                "NestJS",   FrameworkCategory::Backend, 95);
    detect!(text.contains("PrismaClient") || text.contains("@prisma/client"),        "Prisma",   FrameworkCategory::Orm,     95);
    detect!(text.contains("drizzle-orm"),                                             "Drizzle",  FrameworkCategory::Orm,     95);
    detect!(text.contains("from 'mongoose'") || text.contains("require('mongoose')"), "Mongoose",FrameworkCategory::Orm,     90);
    detect!(text.contains("jsonwebtoken") || (text.contains("jwt.sign") && text.contains("jwt.verify")), "JWT", FrameworkCategory::Auth, 85);
    detect!(text.contains("from 'electron'") || text.contains("require('electron')"), "Electron", FrameworkCategory::Runtime, 95);
    detect!(text.contains("@tauri-apps/"),                                            "Tauri",    FrameworkCategory::Runtime, 95);
    detect!(text.contains("from 'next-auth'") || text.contains("@auth/core"),        "NextAuth", FrameworkCategory::Auth,    90);
    detect!(text.contains("createClient") && text.contains("supabase"),              "Supabase", FrameworkCategory::Database, 85);
    detect!(text.contains("fastify") && (text.contains("Fastify(") || text.contains("fastify(")), "Fastify", FrameworkCategory::Backend, 90);
    detect!(text.contains("from 'hono'") || text.contains("from \"hono\""),          "Hono",     FrameworkCategory::Backend, 90);
}

fn scan_py(text: &str, ex: &[FrameworkInfo], out: &mut Vec<FrameworkInfo>) {
    macro_rules! detect {
        ($check:expr, $name:expr, $cat:expr, $conf:expr) => {
            if $check { add($name, $cat, $conf, ex, out); }
        };
    }
    detect!(text.contains("from django") || text.contains("import django"),          "Django",     FrameworkCategory::Backend, 95);
    detect!(text.contains("Flask(__name__)") || (text.contains("from flask") && text.contains("Flask")), "Flask", FrameworkCategory::Backend, 95);
    detect!(text.contains("FastAPI()") || text.contains("from fastapi"),             "FastAPI",    FrameworkCategory::Backend, 95);
    detect!(text.contains("from sqlalchemy") || text.contains("import sqlalchemy"),  "SQLAlchemy", FrameworkCategory::Orm,     95);
    detect!(text.contains("from celery"),                                             "Celery",     FrameworkCategory::Backend, 85);
}

fn scan_go(text: &str, ex: &[FrameworkInfo], out: &mut Vec<FrameworkInfo>) {
    macro_rules! detect {
        ($check:expr, $name:expr, $cat:expr, $conf:expr) => {
            if $check { add($name, $cat, $conf, ex, out); }
        };
    }
    detect!(text.contains("gin-gonic/gin"),  "Gin",  FrameworkCategory::Backend, 95);
    detect!(text.contains("gofiber/fiber"),  "Fiber",FrameworkCategory::Backend, 95);
    detect!(text.contains("labstack/echo"),  "Echo", FrameworkCategory::Backend, 95);
    detect!(text.contains("gorm.io/gorm"),   "GORM", FrameworkCategory::Orm,     95);
    detect!(text.contains("go-chi/chi"),     "Chi",  FrameworkCategory::Backend, 95);
}

fn scan_java(text: &str, ex: &[FrameworkInfo], out: &mut Vec<FrameworkInfo>) {
    macro_rules! detect {
        ($check:expr, $name:expr, $cat:expr, $conf:expr) => {
            if $check { add($name, $cat, $conf, ex, out); }
        };
    }
    detect!(text.contains("@SpringBootApplication") || text.contains("org.springframework"), "Spring Boot", FrameworkCategory::Backend, 95);
    detect!(text.contains("@Entity") && (text.contains("javax.persistence") || text.contains("jakarta.persistence")), "Hibernate", FrameworkCategory::Orm, 90);
    detect!(text.contains("io.quarkus"), "Quarkus", FrameworkCategory::Backend, 95);
}

fn scan_rs(text: &str, ex: &[FrameworkInfo], out: &mut Vec<FrameworkInfo>) {
    macro_rules! detect {
        ($check:expr, $name:expr, $cat:expr, $conf:expr) => {
            if $check { add($name, $cat, $conf, ex, out); }
        };
    }
    detect!(text.contains("use axum::"),    "Axum",     FrameworkCategory::Backend, 95);
    detect!(text.contains("use actix_web"), "Actix Web",FrameworkCategory::Backend, 95);
    detect!(text.contains("use rocket::"),  "Rocket",   FrameworkCategory::Backend, 95);
    detect!(text.contains("use tauri::"),   "Tauri",    FrameworkCategory::Runtime, 95);
    detect!(text.contains("use bevy::"),    "Bevy",     FrameworkCategory::Ui,      95);
    detect!(text.contains("use diesel::"),  "Diesel",   FrameworkCategory::Orm,     95);
    detect!(text.contains("use sea_orm::"), "SeaORM",   FrameworkCategory::Orm,     95);
    detect!(text.contains("use sqlx::"),    "SQLx",     FrameworkCategory::Database, 95);
}

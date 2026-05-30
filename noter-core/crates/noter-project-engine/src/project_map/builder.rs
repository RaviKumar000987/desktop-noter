/// Layer 5 — project map builder.
/// Groups workspace files by semantic purpose using path pattern matching.
use std::collections::HashMap;
use std::path::Path;
use walkdir::WalkDir;
use crate::models::{ModuleCategory, ProjectMap, ProjectModule};

const SKIP_DIRS: &[&str] = &[
    "node_modules", ".git", "target", "dist", "build",
    ".next", "__pycache__", "vendor", ".cache", "coverage",
];
const MAX_FILES_PER_MODULE: usize = 20;
const MAX_TOTAL_FILES: usize = 2000;

pub fn build(root: &Path) -> ProjectMap {
    let mut buckets: HashMap<ModuleCategory, Vec<String>> = HashMap::new();
    let mut total = 0usize;

    for entry in WalkDir::new(root).max_depth(6).into_iter().flatten() {
        if !entry.file_type().is_file() { continue; }

        let rel = match entry.path().strip_prefix(root) {
            Ok(r) => r.to_string_lossy().replace('\\', "/"),
            Err(_) => continue,
        };

        // Skip files inside excluded dirs
        if SKIP_DIRS.iter().any(|d| rel.starts_with(d) || rel.contains(&format!("/{}", d))) {
            continue;
        }

        total += 1;
        if total > MAX_TOTAL_FILES { break; }

        if let Some(cat) = categorize(&rel) {
            let bucket = buckets.entry(cat).or_default();
            if bucket.len() < MAX_FILES_PER_MODULE {
                bucket.push(rel);
            }
        }
    }

    let mut modules: Vec<ProjectModule> = buckets
        .into_iter()
        .map(|(category, mut files)| {
            files.sort();
            ProjectModule {
                name: category.label().to_string(),
                icon: category.icon().to_string(),
                category,
                files,
            }
        })
        .collect();

    modules.sort_by_key(|m| m.category.clone());
    ProjectMap { modules }
}

fn categorize(rel: &str) -> Option<ModuleCategory> {
    let low = rel.to_lowercase();

    // Auth — highest priority
    if low.contains("auth") || low.contains("login") || low.contains("logout")
        || low.contains("register") || low.contains("session")
        || low.contains("oauth") || low.contains("jwt") || low.contains("token")
        || low.contains("password") || low.contains("signup")
    {
        return Some(ModuleCategory::Authentication);
    }

    // Database
    if low.contains("prisma") || low.contains("migration") || low.contains("schema.sql")
        || low.contains("database") || low.ends_with("/db.ts") || low.ends_with("/db.js")
        || rel.starts_with("db/") || low.contains("/db/") || low.contains("seed")
        || low.contains("repository") || low.contains("repositories")
    {
        return Some(ModuleCategory::Database);
    }

    // API / Routes / Controllers
    if low.contains("controller") || low.contains("route") || rel.starts_with("api/")
        || low.contains("/api/") || low.contains("handler") || low.contains("endpoint")
        || low.contains("resolver") || low.contains("graphql")
    {
        return Some(ModuleCategory::Api);
    }

    // Testing
    if low.contains(".test.") || low.contains(".spec.") || low.contains("__tests__")
        || low.contains("/test/") || low.contains("/tests/") || rel.starts_with("tests/")
        || low.contains("cypress") || low.contains("e2e") || low.contains("mock")
        || low.contains("fixture")
    {
        return Some(ModuleCategory::Testing);
    }

    // Build / Config files
    if low.ends_with("vite.config.ts") || low.ends_with("vite.config.js")
        || low.ends_with("webpack.config.js") || low.ends_with("rollup.config.js")
        || low.ends_with("tsconfig.json") || low.ends_with("tsconfig.base.json")
        || low.ends_with(".eslintrc.json") || low.ends_with(".babelrc")
        || low.ends_with("dockerfile") || low.ends_with("docker-compose.yml")
        || low.ends_with("docker-compose.yaml")
    {
        return Some(ModuleCategory::Build);
    }

    // Configuration
    if low.contains("config") || low.starts_with(".env") || low.contains("/.env")
        || low.contains("setting") || low.contains("constant") || low.contains("environment")
        || low.ends_with(".env")
    {
        return Some(ModuleCategory::Configuration);
    }

    // UI / Components / Pages
    if low.contains("component") || low.contains("page") || low.contains("view")
        || low.contains("layout") || low.contains("template") || low.contains("widget")
        || low.ends_with(".css") || low.ends_with(".scss") || low.ends_with(".sass")
        || low.contains("theme") || low.contains("style") || low.contains("assets")
    {
        return Some(ModuleCategory::Ui);
    }

    // Docs
    if low.ends_with(".md") || low.ends_with(".mdx") || rel.starts_with("docs/")
        || low.contains("/docs/")
    {
        return Some(ModuleCategory::Docs);
    }

    // Utilities — catch-all for shared/lib/utils/hooks/middleware/services
    if low.contains("util") || low.contains("helper") || low.contains("common")
        || low.contains("shared") || rel.starts_with("lib/") || low.contains("/lib/")
        || low.contains("hook") || low.contains("middleware") || low.contains("service")
        || low.contains("store") || low.contains("context")
    {
        return Some(ModuleCategory::Utilities);
    }

    None
}

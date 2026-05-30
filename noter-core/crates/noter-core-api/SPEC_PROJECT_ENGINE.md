# noter-project-engine — Phase 1.5 Spec

**Status:** Design only. Implementation starts after Week 4 (Definition + Rename) is complete.

---

## Purpose

Convert a workspace folder into a typed `ProjectMap` that feeds the AI Context Engine (Phase 2) and makes AI suggestions workspace-aware instead of just file-aware.

**Without noter-project-engine:**
```
User: "Add auth middleware"
AI context: current file only
Result: generic boilerplate
```

**With noter-project-engine:**
```
User: "Add auth middleware"
AI context: Express + JWT + PostgreSQL + Prisma detected
Result: middleware matching the project's exact stack
```

---

## Input / Output Contract

```rust
// In noter-core-api/src/types/project.rs (to be created)

pub struct WorkspaceRoot(pub PathBuf);

pub struct ProjectMap {
    pub framework:    Option<String>,       // "React", "Next.js", "Vue", "Express", "FastAPI" …
    pub language:     Vec<String>,          // ["TypeScript", "Python"]
    pub database:     Option<String>,       // "PostgreSQL", "MongoDB", "SQLite", "MySQL"
    pub orm:          Option<String>,       // "Prisma", "TypeORM", "SQLAlchemy", "Drizzle"
    pub auth:         Option<String>,       // "JWT", "OAuth2", "Session", "Clerk", "Auth0"
    pub ui_library:   Option<String>,       // "Tailwind", "MUI", "Chakra", "shadcn/ui"
    pub test_runner:  Option<String>,       // "Jest", "Vitest", "pytest", "go test"
    pub build_tool:   Option<String>,       // "Vite", "webpack", "esbuild", "turbo"
    pub package_manager: Option<String>,   // "npm", "pnpm", "yarn", "cargo", "pip", "go"
    pub entry_points: Vec<PathBuf>,         // ["src/main.ts", "pages/index.tsx", "app/page.tsx"]
    pub confidence:   f32,                  // 0.0 → 1.0 — how sure we are
}
```

---

## Detection Rules (per manifest file)

### `package.json` → JavaScript/TypeScript projects

```
dependencies/devDependencies scan:

Framework detection:
  "next"          → Next.js
  "react-dom"     → React (if no "next")
  "vue"           → Vue
  "svelte"        → Svelte
  "express"       → Express
  "fastify"       → Fastify
  "hono"          → Hono
  "@nestjs/core"  → NestJS
  "@angular/core" → Angular

Database:
  "pg" / "@prisma/client" → PostgreSQL
  "mysql2"                → MySQL
  "mongoose"              → MongoDB
  "better-sqlite3"        → SQLite
  "@planetscale/database" → PlanetScale (MySQL)
  "drizzle-orm"           → Drizzle (check deps for DB type)

ORM:
  "@prisma/client"  → Prisma
  "typeorm"         → TypeORM
  "drizzle-orm"     → Drizzle
  "sequelize"       → Sequelize
  "mikro-orm"       → MikroORM

Auth:
  "jsonwebtoken"    → JWT
  "passport"        → Passport (OAuth/Session)
  "@auth/core"      → Auth.js
  "clerk"           → Clerk

UI:
  "tailwindcss"     → Tailwind
  "@mui/material"   → MUI
  "@chakra-ui/react"→ Chakra
  "shadcn-ui"       → shadcn/ui

Build:
  "vite"            → Vite
  "webpack"         → webpack
  "turbo"           → Turborepo
  "@swc/core"       → SWC
```

### `Cargo.toml` → Rust projects

```
[dependencies] scan:

Framework:
  "axum"       → Axum
  "actix-web"  → Actix
  "warp"       → Warp
  "rocket"     → Rocket

Database:
  "sqlx"       → SQL (check features for db type)
  "diesel"     → Diesel
  "sea-orm"    → SeaORM
  "sled"       → sled
  "redb"       → redb

Auth:
  "jsonwebtoken" → JWT
  "oauth2"       → OAuth2
```

### `requirements.txt` / `pyproject.toml` → Python

```
Framework:
  "fastapi"   → FastAPI
  "flask"     → Flask
  "django"    → Django
  "starlette" → Starlette

Database:
  "sqlalchemy" → SQLAlchemy
  "psycopg2"   → PostgreSQL
  "pymongo"    → MongoDB
  "redis"      → Redis

Auth:
  "python-jose"     → JWT
  "authlib"         → OAuth2
  "django-allauth"  → Django Auth
```

### `go.mod` → Go

```
module path scan:

Framework:
  "gin-gonic/gin"    → Gin
  "labstack/echo"    → Echo
  "gofiber/fiber"    → Fiber
  "go-chi/chi"       → Chi

Database:
  "jmoiron/sqlx"  → SQL
  "gorm.io/gorm"  → GORM
  "go-redis/redis" → Redis
```

### `pom.xml` → Java/Maven

```
artifactId scan:

  "spring-boot-starter-web"  → Spring Boot
  "spring-data-jpa"          → JPA / Hibernate
  "spring-security-core"     → Spring Security
  "postgresql"               → PostgreSQL driver
```

---

## Rust Crate Design

```
noter-core/crates/noter-project-engine/
├── Cargo.toml
└── src/
    ├── lib.rs              ← pub fn scan(root: &Path) -> ProjectMap
    ├── scanner.rs          ← finds manifest files, delegates to parsers
    ├── parsers/
    │   ├── npm.rs          ← package.json → ProjectMap
    │   ├── cargo.rs        ← Cargo.toml → ProjectMap
    │   ├── python.rs       ← requirements.txt / pyproject.toml
    │   ├── go.rs           ← go.mod
    │   └── maven.rs        ← pom.xml
    └── merge.rs            ← if multiple manifests exist, merge detections
```

**Key constraint:** All parsing is pure Rust, no I/O in parsers (pass file content as `&str`). Scanner does the I/O. This makes parsers easily unit-tested.

```rust
// The public API (all that noter-napi needs)
pub fn scan(root: &Path) -> Result<ProjectMap> {
    let scanner = Scanner::new(root);
    let manifests = scanner.find_manifests()?;
    let maps: Vec<ProjectMap> = manifests
        .par_iter()
        .filter_map(|m| parse_manifest(m).ok())
        .collect();
    Ok(merge(maps))
}
```

---

## IPC Contract (to add to noter-core-api/src/ipc/workspace.rs)

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct ScanWorkspaceRequest {
    pub root: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanWorkspaceResponse {
    pub project_map: ProjectMap,
    pub scan_duration_ms: u64,
}
```

## JS Usage (after implementation)

```js
// Triggered once on workspace open, result cached
const map = await window.noter.workspace.scan({ root: workspaceRoot });

// map: { framework: "Next.js", database: "PostgreSQL", orm: "Prisma", auth: "JWT", ... }
// Feed to AI context engine: window.noter.ai.context({ project: map, file: currentUri })
```

---

## Implementation Order (when Phase 1 complete)

1. `ProjectMap` type in `noter-core-api/src/types/project.rs`
2. `noter-project-engine` crate: npm.rs parser first (covers 80% of JS projects)
3. IPC contract in `noter-core-api/src/ipc/workspace.rs`
4. `noter-napi/src/workspace.rs` — expose `scan_workspace(root)` 
5. `noter:workspace:scan` IPC handler in main.js
6. Cache result in `window.noter.workspace.scan()` — re-scan on file watcher changes to manifests
7. Unit tests: parse fixture package.json files, assert ProjectMap fields

---

## Dependencies

- `toml` crate — Cargo.toml / pyproject.toml parsing
- `serde_json` — package.json (already in workspace)
- `roxmltree` — pom.xml (lightweight, no namespace mess)
- `rayon` — parallel parser execution (already in workspace)

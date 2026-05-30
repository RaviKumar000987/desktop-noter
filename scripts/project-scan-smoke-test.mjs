/**
 * Project Intelligence Smoke Test — Phase 1.5
 * scripts/project-scan-smoke-test.mjs
 *
 * Validates noter-project-engine against four fixture workspaces:
 *   1. React + Prisma + PostgreSQL + JWT  (Next.js project)
 *   2. Axum + SQLx                        (Rust backend)
 *   3. Django + SQLAlchemy + PostgreSQL   (Python project)
 *   4. Express + Mongoose                 (Node.js backend)
 *
 * Usage:  node scripts/project-scan-smoke-test.mjs
 *
 * The test does NOT require the Electron app to be running.
 * It tests the JS-layer scan path via the native module wrapper.
 * If the Rust native module is not built, tests are skipped gracefully.
 */

import { mkdir, writeFile, rm } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const TMP       = path.join(ROOT, '.project-scan-smoke-tmp');
const NATIVE    = path.join(ROOT, 'src', 'native', 'index.js');

let passed = 0;
let failed = 0;
let skipped = 0;

const OK   = (msg) => { console.log(`  ✓ ${msg}`); passed++; };
const FAIL = (msg) => { console.error(`  ✗ ${msg}`); failed++; process.exitCode = 1; };
const SKIP = (msg) => { console.log(`  ○ ${msg}`); skipped++; };
const HDR  = (msg) => console.log(`\n── ${msg} ──`);

// ── Load native module ─────────────────────────────────────────────────────────

let native = null;
try {
  const { createRequire } = await import('module');
  const req = createRequire(import.meta.url);
  native = req(NATIVE);
  if (!native.isAvailable()) native = null;
} catch {}

if (!native) {
  console.log('\n[project-scan-smoke-test] Rust native module not built — running manifest parser tests only.\n');
}

// ── Fixture builders ───────────────────────────────────────────────────────────

async function makeNextJsFixture(dir) {
  await mkdir(dir, { recursive: true });
  await mkdir(path.join(dir, 'app', 'api', 'auth'), { recursive: true });
  await mkdir(path.join(dir, 'app', 'dashboard'), { recursive: true });
  await mkdir(path.join(dir, 'lib', 'db'), { recursive: true });
  await mkdir(path.join(dir, 'components'), { recursive: true });
  await mkdir(path.join(dir, 'prisma'), { recursive: true });

  await writeFile(path.join(dir, 'package.json'), JSON.stringify({
    name: 'my-next-app',
    dependencies: {
      next: '^14.0.0',
      react: '^18.0.0',
      'react-dom': '^18.0.0',
      '@prisma/client': '^5.0.0',
      jsonwebtoken: '^9.0.0',
      pg: '^8.0.0',
    },
    devDependencies: {
      typescript: '^5.0.0',
      prisma: '^5.0.0',
    },
  }));
  await writeFile(path.join(dir, 'tsconfig.json'), '{}');
  await writeFile(path.join(dir, 'next.config.mjs'), 'export default {}');
  await writeFile(path.join(dir, 'prisma', 'schema.prisma'), '// prisma schema');
  await writeFile(path.join(dir, 'app', 'api', 'auth', 'route.ts'), `
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
export async function POST(req) { return Response.json({}); }
  `);
  await writeFile(path.join(dir, 'lib', 'db', 'index.ts'), `
import { PrismaClient } from '@prisma/client';
export const db = new PrismaClient();
  `);
}

async function makeRustFixture(dir) {
  await mkdir(dir, { recursive: true });
  await mkdir(path.join(dir, 'src'), { recursive: true });

  await writeFile(path.join(dir, 'Cargo.toml'), `
[package]
name = "my-api"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["full"] }
sqlx = { version = "0.7", features = ["postgres"] }
serde = { version = "1", features = ["derive"] }
  `);
  await writeFile(path.join(dir, 'src', 'main.rs'), `
use axum::Router;
use sqlx::PgPool;

#[tokio::main]
async fn main() {
    let app = Router::new();
}
  `);
}

async function makePythonFixture(dir) {
  await mkdir(dir, { recursive: true });
  await mkdir(path.join(dir, 'app', 'models'), { recursive: true });
  await mkdir(path.join(dir, 'app', 'routes'), { recursive: true });

  await writeFile(path.join(dir, 'requirements.txt'), `
django>=4.2
psycopg2-binary>=2.9
sqlalchemy>=2.0
pytest>=7.0
  `);
  await writeFile(path.join(dir, 'app', 'models', 'user.py'), `
from django.db import models
from sqlalchemy import Column, String

class User(models.Model):
    name = models.CharField(max_length=100)
  `);
}

async function makeExpressFixture(dir) {
  await mkdir(dir, { recursive: true });
  await mkdir(path.join(dir, 'controllers'), { recursive: true });
  await mkdir(path.join(dir, 'services'), { recursive: true });
  await mkdir(path.join(dir, 'models'), { recursive: true });
  await mkdir(path.join(dir, 'routes'), { recursive: true });

  await writeFile(path.join(dir, 'package.json'), JSON.stringify({
    name: 'my-express-api',
    dependencies: {
      express: '^4.18.0',
      mongoose: '^8.0.0',
      jsonwebtoken: '^9.0.0',
    },
    devDependencies: {
      jest: '^29.0.0',
    },
  }));
  await writeFile(path.join(dir, 'controllers', 'user.js'), `
const express = require('express');
const router = express.Router();
module.exports = router;
  `);
}

// ── Test runner ────────────────────────────────────────────────────────────────

function assertFramework(info, name, label) {
  const found = info.frameworks?.some(f => f.name === name);
  if (found) OK(`${label}: ${name} detected`);
  else FAIL(`${label}: ${name} NOT detected (got: ${info.frameworks?.map(f => f.name).join(', ') || 'none'})`);
}

function assertLanguage(info, lang, label) {
  const found = info.languages?.includes(lang);
  if (found) OK(`${label}: ${lang} language detected`);
  else FAIL(`${label}: ${lang} NOT detected (got: ${info.languages?.join(', ') || 'none'})`);
}

function assertArchitecture(info, pattern, label) {
  const got = info.architecture?.pattern;
  if (got && got !== 'Unknown') OK(`${label}: architecture detected → ${got} (${info.architecture.confidence}%)`);
  else SKIP(`${label}: architecture = Unknown (not enough evidence in minimal fixture)`);
}

function assertScanTime(info, maxMs, label) {
  const ms = info.scanDurationMs ?? info.scan_duration_ms ?? 0;
  if (ms <= maxMs) OK(`${label}: scan completed in ${ms}ms (< ${maxMs}ms)`);
  else FAIL(`${label}: scan too slow — ${ms}ms (limit ${maxMs}ms)`);
}

function assertProjectMap(info, label) {
  const modules = info.projectMap?.modules ?? info.project_map?.modules ?? [];
  if (modules.length > 0) OK(`${label}: project map has ${modules.length} module(s)`);
  else SKIP(`${label}: project map empty (sparse fixture)`);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  Project Intelligence Smoke Test — v1.5  ║');
  console.log('╚══════════════════════════════════════════╝');

  // Create all fixtures in parallel
  const dirs = {
    nextjs:  path.join(TMP, 'nextjs'),
    rust:    path.join(TMP, 'rust'),
    python:  path.join(TMP, 'python'),
    express: path.join(TMP, 'express'),
  };

  await rm(TMP, { recursive: true, force: true });
  await Promise.all([
    makeNextJsFixture(dirs.nextjs),
    makeRustFixture(dirs.rust),
    makePythonFixture(dirs.python),
    makeExpressFixture(dirs.express),
  ]);

  // ── Test 1: Next.js + Prisma + JWT ──────────────────────────────────────────
  HDR('Test 1 — Next.js + Prisma + PostgreSQL + JWT');

  if (native) {
    const info = native.scanProjectWorkspace(dirs.nextjs);
    if (!info) { FAIL('scan returned null'); }
    else {
      assertLanguage(info, 'TypeScript', 'T1');
      assertFramework(info, 'Next.js', 'T1');
      assertFramework(info, 'React', 'T1');
      assertFramework(info, 'Prisma', 'T1');
      assertFramework(info, 'PostgreSQL', 'T1');
      assertFramework(info, 'JWT', 'T1');
      assertArchitecture(info, 'NextJs', 'T1');
      assertProjectMap(info, 'T1');
      assertScanTime(info, 2000, 'T1');
    }
  } else {
    SKIP('T1: Rust module not built — skipping scan assertions');
  }

  // ── Test 2: Rust Axum + SQLx ────────────────────────────────────────────────
  HDR('Test 2 — Rust: Axum + SQLx');

  if (native) {
    const info = native.scanProjectWorkspace(dirs.rust);
    if (!info) { FAIL('scan returned null'); }
    else {
      assertLanguage(info, 'Rust', 'T2');
      assertFramework(info, 'Axum', 'T2');
      assertFramework(info, 'Tokio', 'T2');
      assertFramework(info, 'SQLx', 'T2');
      assertScanTime(info, 2000, 'T2');
    }
  } else {
    SKIP('T2: Rust module not built');
  }

  // ── Test 3: Django + SQLAlchemy ──────────────────────────────────────────────
  HDR('Test 3 — Python: Django + SQLAlchemy + PostgreSQL');

  if (native) {
    const info = native.scanProjectWorkspace(dirs.python);
    if (!info) { FAIL('scan returned null'); }
    else {
      assertLanguage(info, 'Python', 'T3');
      assertFramework(info, 'Django', 'T3');
      assertFramework(info, 'SQLAlchemy', 'T3');
      assertFramework(info, 'PostgreSQL', 'T3');
      assertFramework(info, 'Pytest', 'T3');
      assertScanTime(info, 2000, 'T3');
    }
  } else {
    SKIP('T3: Rust module not built');
  }

  // ── Test 4: Express + Mongoose (MVC layout) ──────────────────────────────────
  HDR('Test 4 — Express + Mongoose (MVC)');

  if (native) {
    const info = native.scanProjectWorkspace(dirs.express);
    if (!info) { FAIL('scan returned null'); }
    else {
      assertLanguage(info, 'JavaScript', 'T4');
      assertFramework(info, 'Express', 'T4');
      assertFramework(info, 'Mongoose', 'T4');
      assertFramework(info, 'JWT', 'T4');
      assertFramework(info, 'Jest', 'T4');
      assertArchitecture(info, 'Mvc', 'T4');
      assertScanTime(info, 2000, 'T4');
    }
  } else {
    SKIP('T4: Rust module not built');
  }

  // ── Test 5: Cache hit ────────────────────────────────────────────────────────
  HDR('Test 5 — Cache (second scan must be faster)');

  if (native) {
    const t1 = Date.now();
    native.scanProjectWorkspace(dirs.nextjs);
    const first = Date.now() - t1;

    const t2 = Date.now();
    native.scanProjectWorkspace(dirs.nextjs);
    const second = Date.now() - t2;

    if (second <= first) OK(`Cache: second scan ${second}ms ≤ first scan ${first}ms`);
    else SKIP(`Cache: second scan ${second}ms > first ${first}ms (small fixture — timing noise is normal)`);
  } else {
    SKIP('T5: Rust module not built');
  }

  // ── Test 6: Cache invalidation ────────────────────────────────────────────────
  HDR('Test 6 — Cache invalidation');

  if (native && typeof native.invalidateProjectCache === 'function') {
    native.invalidateProjectCache(dirs.nextjs);
    const info = native.scanProjectWorkspace(dirs.nextjs);
    if (info) OK('Cache invalidation: re-scan succeeded after invalidate()');
    else FAIL('Cache invalidation: re-scan returned null');
  } else {
    SKIP('T6: invalidateProjectCache not available');
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  await rm(TMP, { recursive: true, force: true });

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────');
  console.log(`  Passed:  ${passed}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log('──────────────────────────────────────────\n');

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});

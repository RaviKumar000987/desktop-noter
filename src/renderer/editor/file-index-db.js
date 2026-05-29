// ═══════════════════════════════════════════════════════════════
//  NOTER FILE INDEX DB — src/renderer/editor/file-index-db.js
//
//  IndexedDB-backed symbol/word index for the workspace.
//  Replaces the in-memory Map that gets wiped on every reload.
//
//  Schema (DB: noter-file-index-v1):
//    files store  — { path, lang, hash, symbols[], words[], mtime }
//    words store  — { word, paths[] }  (inverted index for search)
//
//  Incremental flow:
//    1. File changed → FileIndexDB.upsert(path, lang, content)
//    2. Worker extracts symbols → stored in DB
//    3. Search query → FileIndexDB.searchSymbols('myFn')
//    4. File deleted → FileIndexDB.remove(path)
//
//  Usage:
//    await FileIndexDB.init();
//    await FileIndexDB.upsert('/src/app.js', 'javascript', content);
//    const symbols = await FileIndexDB.getSymbols('/src/app.js');
//    const hits    = await FileIndexDB.searchSymbols('myFn');
//    await FileIndexDB.remove('/src/app.js');
// ═══════════════════════════════════════════════════════════════
'use strict';

window.FileIndexDB = (() => {
  const DB_NAME    = 'noter-file-index-v1';
  const DB_VERSION = 1;

  let _db = null;

  // ── Symbol extractors (same as worker, kept in sync) ─────────
  const EXTRACTORS = {
    javascript: /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=|class\s+(\w+)|export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+))/g,
    typescript: /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=|class\s+(\w+)|interface\s+(\w+)|type\s+(\w+)\s*=|enum\s+(\w+))/g,
    python:     /(?:def\s+(\w+)|class\s+(\w+)|^(\w+)\s*=(?!=))/gm,
    java:       /(?:class\s+(\w+)|interface\s+(\w+)|enum\s+(\w+)|(?:public|private|protected|static)\s+\w[\w<>[\]]*\s+(\w+)\s*[=(])/g,
    go:         /(?:func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)|type\s+(\w+)\s+(?:struct|interface)|var\s+(\w+))/g,
    rust:       /(?:fn\s+(\w+)|struct\s+(\w+)|enum\s+(\w+)|trait\s+(\w+)|impl\s+(\w+)|const\s+(\w+))/g,
    csharp:     /(?:class\s+(\w+)|interface\s+(\w+)|enum\s+(\w+)|(?:public|private|protected)\s+\w[\w<>[\]]*\s+(\w+)\s*[({])/g,
    php:        /(?:function\s+(\w+)|class\s+(\w+)|\$(\w+)\s*=)/g,
    ruby:       /(?:def\s+(\w+)|class\s+(\w+)|module\s+(\w+))/g,
  };

  function _normLang(lang) {
    if (lang === 'javascriptreact') return 'javascript';
    if (lang === 'typescriptreact') return 'typescript';
    return lang;
  }

  function _extractSymbols(content, lang) {
    const symbols = new Set();
    const words   = new Set();
    const wordMatches = content.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]{2,}\b/g);
    if (wordMatches) wordMatches.forEach(w => words.add(w));
    const re = EXTRACTORS[_normLang(lang)];
    if (re) {
      const copy = new RegExp(re.source, re.flags);
      let m;
      while ((m = copy.exec(content)) !== null) {
        for (let i = 1; i < m.length; i++) if (m[i]) symbols.add(m[i]);
      }
    }
    return { symbols: [...symbols], words: [...words] };
  }

  // Simple 32-bit hash for change detection
  function _hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h.toString(16);
  }

  // ── IndexedDB helpers ─────────────────────────────────────────

  function _open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        // files: keyed by path
        const files = db.createObjectStore('files', { keyPath: 'path' });
        files.createIndex('lang', 'lang', { unique: false });
        files.createIndex('mtime', 'mtime', { unique: false });
        // words: inverted index
        db.createObjectStore('words', { keyPath: 'word' });
      };

      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  function _p(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ── Public API ────────────────────────────────────────────────

  async function init() {
    if (_db) return;
    _db = await _open();
  }

  /**
   * Index or update a file.
   * No-op if content hash hasn't changed (incremental).
   */
  async function upsert(path, lang, content) {
    if (!_db) await init();
    const hash  = _hash(content);
    const tx    = _db.transaction(['files', 'words'], 'readwrite');
    const files = tx.objectStore('files');
    const words = tx.objectStore('words');

    // Check existing hash → skip if unchanged
    const existing = await _p(files.get(path));
    if (existing && existing.hash === hash) return;

    const { symbols, words: wordList } = _extractSymbols(content, lang);

    // Remove old word → path mappings
    if (existing) {
      for (const w of (existing.words || [])) {
        const rec = await _p(words.get(w));
        if (rec) {
          rec.paths = rec.paths.filter(p => p !== path);
          if (rec.paths.length) words.put(rec);
          else words.delete(w);
        }
      }
    }

    // Write new file record
    files.put({ path, lang, hash, symbols, words: wordList, mtime: Date.now() });

    // Update inverted index for words
    for (const w of wordList) {
      const rec = await _p(words.get(w));
      if (rec) {
        if (!rec.paths.includes(path)) rec.paths.push(path);
        words.put(rec);
      } else {
        words.put({ word: w, paths: [path] });
      }
    }
  }

  /** Remove a file from the index (called on file delete). */
  async function remove(path) {
    if (!_db) await init();
    const tx    = _db.transaction(['files', 'words'], 'readwrite');
    const files = tx.objectStore('files');
    const words = tx.objectStore('words');

    const existing = await _p(files.get(path));
    if (!existing) return;

    files.delete(path);

    for (const w of (existing.words || [])) {
      const rec = await _p(words.get(w));
      if (!rec) continue;
      rec.paths = rec.paths.filter(p => p !== path);
      if (rec.paths.length) words.put(rec);
      else words.delete(w);
    }
  }

  /** Get symbols for a specific file. */
  async function getSymbols(path) {
    if (!_db) await init();
    const rec = await _p(_db.transaction('files').objectStore('files').get(path));
    return rec ? rec.symbols : [];
  }

  /** Get all words for a specific file. */
  async function getWords(path) {
    if (!_db) await init();
    const rec = await _p(_db.transaction('files').objectStore('files').get(path));
    return rec ? rec.words : [];
  }

  /**
   * Find all files that define a symbol starting with `prefix`.
   * Returns Array<{ symbol, path }>.
   */
  async function searchSymbols(prefix) {
    if (!_db) await init();
    const lower   = prefix.toLowerCase();
    const results = [];
    const store   = _db.transaction('files').objectStore('files');

    await new Promise((resolve) => {
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) { resolve(); return; }
        const { path, symbols } = cursor.value;
        for (const s of (symbols || [])) {
          if (s.toLowerCase().startsWith(lower)) results.push({ symbol: s, path });
        }
        cursor.continue();
      };
      req.onerror = () => resolve();
    });

    return results;
  }

  /**
   * Full workspace word search — returns file paths that contain `word`.
   */
  async function searchWord(word) {
    if (!_db) await init();
    const rec = await _p(_db.transaction('words').objectStore('words').get(word));
    return rec ? rec.paths : [];
  }

  /** Return all indexed file paths. */
  async function allPaths() {
    if (!_db) await init();
    return _p(_db.transaction('files').objectStore('files').getAllKeys());
  }

  /** Wipe the entire index. */
  async function clearAll() {
    if (!_db) await init();
    const tx = _db.transaction(['files', 'words'], 'readwrite');
    tx.objectStore('files').clear();
    tx.objectStore('words').clear();
  }

  async function stats() {
    if (!_db) await init();
    const [fileCount, wordCount] = await Promise.all([
      _p(_db.transaction('files').objectStore('files').count()),
      _p(_db.transaction('words').objectStore('words').count()),
    ]);
    return { files: fileCount, words: wordCount };
  }

  return { init, upsert, remove, getSymbols, getWords, searchSymbols, searchWord, allPaths, clearAll, stats };
})();

/**
 * NOTER — Indexer Web Worker  (incremental edition)
 *
 * Protocol v2 (backwards-compatible with v1):
 *
 *   BATCH index (v1 compatible):
 *     main → worker: { id, files: [{path, content, lang}] }
 *     worker → main: { id, results: { [path]: {symbols, words} } }
 *
 *   INCREMENTAL ops (v2 new):
 *     main → worker: { id, op: 'upsert', path, content, lang }
 *     worker → main: { id, op: 'upsert', path, result: {symbols, words}, changed: bool }
 *
 *     main → worker: { id, op: 'delete', path }
 *     worker → main: { id, op: 'delete', path }
 *
 *     main → worker: { id, op: 'query', prefix }
 *     worker → main: { id, op: 'query', results: [{symbol, path}] }
 *
 *     main → worker: { id, op: 'stats' }
 *     worker → main: { id, op: 'stats', files: N, words: N }
 *
 * The worker maintains an in-memory index so repeated calls for the
 * same unchanged file (same hash) are instant no-ops.
 */

// ── Symbol extractors ─────────────────────────────────────────────────────
const EXTRACTORS = {
  javascript: /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=|class\s+(\w+)|export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+))/g,
  typescript: /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=|class\s+(\w+)|interface\s+(\w+)|type\s+(\w+)\s*=|enum\s+(\w+))/g,
  python:     /(?:def\s+(\w+)|class\s+(\w+)|^(\w+)\s*=(?!=))/gm,
  java:       /(?:class\s+(\w+)|interface\s+(\w+)|enum\s+(\w+)|(?:public|private|protected|static)\s+\w[\w<>[\]]*\s+(\w+)\s*[=(])/g,
  go:         /(?:func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)|type\s+(\w+)\s+(?:struct|interface)|var\s+(\w+))/g,
  rust:       /(?:fn\s+(\w+)|struct\s+(\w+)|enum\s+(\w+)|trait\s+(\w+)|impl\s+(\w+)|const\s+(\w+)|let\s+(?:mut\s+)?(\w+))/g,
  csharp:     /(?:class\s+(\w+)|interface\s+(\w+)|enum\s+(\w+)|(?:public|private|protected|internal|static|abstract|virtual)\s+\w[\w<>[\]]*\s+(\w+)\s*[({])/g,
  php:        /(?:function\s+(\w+)|class\s+(\w+)|interface\s+(\w+)|\$(\w+)\s*=)/g,
  ruby:       /(?:def\s+(\w+)|class\s+(\w+)|module\s+(\w+)|(\w+)\s*=)/g,
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

function _hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h.toString(16);
}

// ── In-memory incremental index ───────────────────────────────────────────
// path → { symbols, words, hash }
const _index = new Map();

// ── Message handler ───────────────────────────────────────────────────────

self.onmessage = ({ data }) => {
  const { id } = data;

  // ── v1 batch mode ─────────────────────────────────────────────
  if (data.files && !data.op) {
    const results = {};
    for (const { path: fp, content, lang } of data.files) {
      if (!content) continue;
      try { results[fp] = _extractSymbols(content, lang); } catch { /* skip */ }
    }
    self.postMessage({ id, results });
    return;
  }

  // ── v2 incremental ops ────────────────────────────────────────
  switch (data.op) {

    case 'upsert': {
      const { path, content, lang } = data;
      if (!content) { self.postMessage({ id, op: 'upsert', path, result: null, changed: false }); return; }
      const hash = _hash(content);
      const existing = _index.get(path);
      if (existing && existing.hash === hash) {
        self.postMessage({ id, op: 'upsert', path, result: existing, changed: false });
        return;
      }
      try {
        const result = { ..._extractSymbols(content, lang), hash };
        _index.set(path, result);
        self.postMessage({ id, op: 'upsert', path, result, changed: true });
      } catch (e) {
        self.postMessage({ id, op: 'upsert', path, result: null, changed: false, error: e.message });
      }
      break;
    }

    case 'delete': {
      _index.delete(data.path);
      self.postMessage({ id, op: 'delete', path: data.path });
      break;
    }

    case 'query': {
      const { prefix } = data;
      const lower   = (prefix || '').toLowerCase();
      const results = [];
      for (const [path, entry] of _index) {
        for (const s of entry.symbols) {
          if (s.toLowerCase().startsWith(lower)) results.push({ symbol: s, path });
        }
      }
      self.postMessage({ id, op: 'query', results });
      break;
    }

    case 'stats': {
      let words = 0;
      for (const e of _index.values()) words += e.words.length;
      self.postMessage({ id, op: 'stats', files: _index.size, words });
      break;
    }

    case 'clear': {
      _index.clear();
      self.postMessage({ id, op: 'clear' });
      break;
    }

    default:
      self.postMessage({ id, error: `Unknown op: ${data.op}` });
  }
};

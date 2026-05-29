/**
 * NOTER — Indexer Web Worker
 *
 * Receives a batch of { path, content, lang } objects via postMessage,
 * extracts symbols and word tokens with regex (CPU-heavy work),
 * then posts results back to the main thread.
 *
 * Running this in a worker keeps the Monaco editor and UI thread fully
 * responsive during large workspace indexing operations.
 *
 * Protocol:
 *   main → worker: { id: number, files: Array<{path, content, lang}> }
 *   worker → main: { id: number, results: Record<path, {symbols, words}> }
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

function _normaliseKey(lang) {
  if (lang === "javascriptreact") return "javascript";
  if (lang === "typescriptreact") return "typescript";
  return lang;
}

function _extractSymbols(content, lang) {
  const symbols = new Set();
  const words   = new Set();

  // General word tokens for cross-file word-based completions
  const wordMatches = content.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]{2,}\b/g);
  if (wordMatches) wordMatches.forEach(w => words.add(w));

  const re = EXTRACTORS[_normaliseKey(lang)];
  if (re) {
    const copy = new RegExp(re.source, re.flags);
    let m;
    while ((m = copy.exec(content)) !== null) {
      for (let i = 1; i < m.length; i++) {
        if (m[i]) symbols.add(m[i]);
      }
    }
  }

  return { symbols: [...symbols], words: [...words] };
}

// ── Message handler ───────────────────────────────────────────────────────

self.onmessage = ({ data }) => {
  const { id, files } = data;
  const results = {};

  for (const { path: fp, content, lang } of files) {
    if (!content) continue;
    try {
      results[fp] = _extractSymbols(content, lang);
    } catch {
      // Skip files that cause regex issues
    }
  }

  self.postMessage({ id, results });
};

/**
 * NOTER — Search Web Worker
 *
 * Runs full-text and regex searches across workspace file contents
 * entirely off the UI thread.
 *
 * Protocol:
 *
 *   TEXT search:
 *     main → worker: { id, op: 'search', query, files: [{path,content}],
 *                       caseSensitive?, wholeWord?, regex? }
 *     worker → main: { id, op: 'search', results: [{path, matches:[{line,col,text,lineText}]}] }
 *
 *   REPLACE preview:
 *     main → worker: { id, op: 'preview', query, replace, files: [{path,content}],
 *                       caseSensitive?, regex? }
 *     worker → main: { id, op: 'preview', results: [{path, newContent, count}] }
 *
 *   SYMBOL search (workspace-wide):
 *     main → worker: { id, op: 'symbols', prefix, index: {[path]:{symbols[]}} }
 *     worker → main: { id, op: 'symbols', results: [{symbol,path}] }
 */

// ── Helpers ───────────────────────────────────────────────────────────────

function _buildRegex(query, { caseSensitive = false, wholeWord = false, regex = false } = {}) {
  let pattern = regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (wholeWord) pattern = `\\b${pattern}\\b`;
  const flags = caseSensitive ? 'gd' : 'gid';
  try { return new RegExp(pattern, flags); }
  catch { return new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); }
}

function _searchFile(path, content, re) {
  const lines   = content.split('\n');
  const matches = [];
  re.lastIndex  = 0;

  for (let li = 0; li < lines.length; li++) {
    const lineText = lines[li];
    re.lastIndex   = 0;
    let m;
    while ((m = re.exec(lineText)) !== null) {
      matches.push({
        line:     li + 1,
        col:      m.index + 1,
        text:     m[0],
        lineText: lineText.slice(0, 200),
      });
      if (!re.global) break;
    }
  }
  return matches;
}

function _replaceFile(content, re, replace) {
  re.lastIndex = 0;
  let count = 0;
  const newContent = content.replace(re, () => { count++; return replace; });
  return { newContent, count };
}

// ── Message handler ───────────────────────────────────────────────────────

self.onmessage = ({ data }) => {
  const { id, op } = data;

  switch (op) {

    case 'search': {
      const { query, files, caseSensitive, wholeWord, regex } = data;
      if (!query || !files?.length) {
        self.postMessage({ id, op: 'search', results: [] });
        return;
      }
      const re      = _buildRegex(query, { caseSensitive, wholeWord, regex });
      const results = [];
      for (const { path, content } of files) {
        if (!content) continue;
        const matches = _searchFile(path, content, re);
        if (matches.length) results.push({ path, matches });
      }
      self.postMessage({ id, op: 'search', results });
      break;
    }

    case 'preview': {
      const { query, replace = '', files, caseSensitive, regex } = data;
      if (!query || !files?.length) {
        self.postMessage({ id, op: 'preview', results: [] });
        return;
      }
      const re      = _buildRegex(query, { caseSensitive, regex });
      const results = [];
      for (const { path, content } of files) {
        if (!content) continue;
        const { newContent, count } = _replaceFile(content, re, replace);
        if (count) results.push({ path, newContent, count });
      }
      self.postMessage({ id, op: 'preview', results });
      break;
    }

    case 'symbols': {
      const { prefix, index } = data;
      if (!prefix || !index) { self.postMessage({ id, op: 'symbols', results: [] }); return; }
      const lower   = prefix.toLowerCase();
      const results = [];
      for (const [path, entry] of Object.entries(index)) {
        for (const s of (entry.symbols || [])) {
          if (s.toLowerCase().startsWith(lower)) results.push({ symbol: s, path });
        }
      }
      // Sort: exact prefix first, then alphabetical
      results.sort((a, b) => {
        const ae = a.symbol.toLowerCase() === lower ? 0 : 1;
        const be = b.symbol.toLowerCase() === lower ? 0 : 1;
        if (ae !== be) return ae - be;
        return a.symbol.localeCompare(b.symbol);
      });
      self.postMessage({ id, op: 'symbols', results: results.slice(0, 200) });
      break;
    }

    default:
      self.postMessage({ id, error: `Unknown op: ${op}` });
  }
};

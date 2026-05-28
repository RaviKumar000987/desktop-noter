// ─── DSA Forge ───────────────────────────────────────────────────
// Flagship extension: 50+ DSA snippets + algorithm quick-reference panel.

(window._exts = window._exts || {})['dsa-forge'] = (() => {
  'use strict';

  let _ctx;
  let _disposables = [];

  const SNIPPETS_JS = [
    { label:'dsaBinarySearch', detail:'Binary Search O(log n)',
      insertText:"function binarySearch(arr, target) {\n  let lo = 0, hi = arr.length - 1;\n  while (lo <= hi) {\n    const mid = (lo + hi) >> 1;\n    if (arr[mid] === target) return mid;\n    arr[mid] < target ? lo = mid + 1 : hi = mid - 1;\n  }\n  return -1;\n}" },
    { label:'dsaTwoPointers', detail:'Two Pointers template',
      insertText:"function twoPointers(arr) {\n  let lo = 0, hi = arr.length - 1;\n  while (lo < hi) {\n    // process arr[lo], arr[hi]\n    ${1:lo++; hi--;}\n  }\n}" },
    { label:'dsaSlidingWindow', detail:'Sliding Window (fixed size)',
      insertText:"function slidingWindow(arr, k) {\n  let maxSum = 0, winSum = 0;\n  for (let i = 0; i < k; i++) winSum += arr[i];\n  maxSum = winSum;\n  for (let i = k; i < arr.length; i++) {\n    winSum += arr[i] - arr[i - k];\n    maxSum = Math.max(maxSum, winSum);\n  }\n  return maxSum;\n}" },
    { label:'dsaDFS', detail:'DFS on adjacency list',
      insertText:"function dfs(graph, start) {\n  const visited = new Set();\n  function explore(node) {\n    visited.add(node);\n    for (const nb of (graph[node] || [])) {\n      if (!visited.has(nb)) explore(nb);\n    }\n  }\n  explore(start);\n  return visited;\n}" },
    { label:'dsaBFS', detail:'BFS on adjacency list',
      insertText:"function bfs(graph, start) {\n  const visited = new Set([start]);\n  const queue = [start];\n  while (queue.length) {\n    const node = queue.shift();\n    for (const nb of (graph[node] || [])) {\n      if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }\n    }\n  }\n  return visited;\n}" },
    { label:'dsaMergeSort', detail:'Merge Sort O(n log n)',
      insertText:"function mergeSort(arr) {\n  if (arr.length <= 1) return arr;\n  const mid = arr.length >> 1;\n  const L = mergeSort(arr.slice(0, mid));\n  const R = mergeSort(arr.slice(mid));\n  return merge(L, R);\n}\nfunction merge(L, R) {\n  const res = []; let i = 0, j = 0;\n  while (i < L.length && j < R.length)\n    res.push(L[i] <= R[j] ? L[i++] : R[j++]);\n  return [...res, ...L.slice(i), ...R.slice(j)];\n}" },
    { label:'dsaDP', detail:'DP memoization template',
      insertText:"const memo = {};\nfunction dp(${1:state}) {\n  if (${1:state} in memo) return memo[${1:state}];\n  // base case\n  if (${2:baseCondition}) return ${3:0};\n  // recurse\n  memo[${1:state}] = ${4:/* your logic */};\n  return memo[${1:state}];\n}" },
    { label:'dsaStack', detail:'Stack using array',
      insertText:"const stack = [];\nstack.push(${1:item});     // push\nconst top = stack.pop();  // pop\nconst peek = stack[stack.length - 1];" },
    { label:'dsaQueue', detail:'Queue using array',
      insertText:"const queue = [];\nqueue.push(${1:item});      // enqueue\nconst front = queue.shift(); // dequeue" },
    { label:'dsaPriorityQueue', detail:'MinHeap PriorityQueue',
      insertText:"class MinHeap {\n  constructor() { this.h = []; }\n  push(v) { this.h.push(v); this.h.sort((a,b)=>a-b); }\n  pop()  { return this.h.shift(); }\n  peek() { return this.h[0]; }\n  size() { return this.h.length; }\n}" },
    { label:'dsaUnionFind', detail:'Union-Find (Disjoint Set)',
      insertText:"class UnionFind {\n  constructor(n) { this.p = Array.from({length:n},(_,i)=>i); this.rank=new Array(n).fill(0); }\n  find(x) { return this.p[x]===x ? x : (this.p[x]=this.find(this.p[x])); }\n  union(x,y) {\n    const px=this.find(x), py=this.find(y);\n    if(px===py) return false;\n    this.rank[px]>=this.rank[py] ? this.p[py]=px : this.p[px]=py;\n    if(this.rank[px]===this.rank[py]) this.rank[px]++;\n    return true;\n  }\n}" },
    { label:'dsaTrieNode', detail:'Trie data structure',
      insertText:"class TrieNode { constructor() { this.children={}; this.end=false; } }\nclass Trie {\n  constructor() { this.root=new TrieNode(); }\n  insert(w) { let n=this.root; for(const c of w){n.children[c]??=new TrieNode();n=n.children[c];} n.end=true; }\n  search(w) { let n=this.root; for(const c of w){if(!n.children[c])return false;n=n.children[c];} return n.end; }\n  startsWith(p){ let n=this.root; for(const c of p){if(!n.children[c])return false;n=n.children[c];} return true; }\n}" },
  ];

  const ALGOS = [
    { name:'Binary Search', tc:'O(log n)', sc:'O(1)', desc:'Sorted array, halve search space each step.' },
    { name:'BFS',           tc:'O(V+E)',  sc:'O(V)', desc:'Shortest path in unweighted graphs, level order.' },
    { name:'DFS',           tc:'O(V+E)',  sc:'O(V)', desc:'Connected components, cycle detection, topological sort.' },
    { name:'Merge Sort',    tc:'O(n log n)', sc:'O(n)', desc:'Stable sort, good for linked lists and external sort.' },
    { name:'Quick Sort',    tc:'O(n log n) avg', sc:'O(log n)', desc:'In-place, fast in practice. Worst O(n²) without pivot strategy.' },
    { name:'Dynamic Prog.', tc:'Varies',  sc:'Varies', desc:'Overlapping subproblems + optimal substructure. Memoize top-down or tabulate bottom-up.' },
    { name:'Union-Find',    tc:'O(α(n))', sc:'O(n)', desc:'Near-constant amortized. Cycle detection, MST components.' },
    { name:'Dijkstra',      tc:'O((V+E)log V)', sc:'O(V)', desc:'Shortest path in weighted graphs (no negative edges).' },
    { name:'Two Pointers',  tc:'O(n)',    sc:'O(1)', desc:'Sorted arrays, palindromes, pair sums.' },
    { name:'Sliding Window',tc:'O(n)',    sc:'O(k)', desc:'Subarray / substring problems with fixed or variable window.' },
  ];

  function _openPanel() {
    const id = 'ext-dsa-panel';
    document.getElementById(id)?.remove();

    const algoRows = ALGOS.map(a => `
      <div style="padding:6px 0;border-bottom:1px solid #21262d">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
          <span style="font-size:13px;font-weight:600;color:#e6edf3">${a.name}</span>
          <span style="font-size:11px;color:#58a6ff;white-space:nowrap">T: ${a.tc}</span>
          <span style="font-size:11px;color:#3fb950;white-space:nowrap">S: ${a.sc}</span>
        </div>
        <div style="font-size:11.5px;color:#7d8590;margin-top:3px">${a.desc}</div>
      </div>`).join('');

    const panel = _ctx.openPanel(id, 'DSA Forge — Reference', `
      <div style="font-size:11px;color:#7d8590;margin-bottom:10px">
        Type prefix in editor (e.g. <code style="background:#21262d;padding:1px 5px;border-radius:3px">dsa</code>) for snippets.
      </div>
      <div class="dash-section-title">Algorithm Cheatsheet</div>
      ${algoRows}
    `, { icon: '🧮' });

    return panel;
  }

  function activate(ctx) {
    _ctx = ctx;
    ctx.addToolbarBtn({
      id:    'ext-dsa-btn',
      icon:  '🧮',
      label: 'DSA',
      title: 'DSA Forge — snippets & reference panel',
      run:   _openPanel,
    });

    // Register snippets for JS/TS
    ['javascript','typescript','cpp','c','python'].forEach(lang => {
      _disposables.push(
        monaco.languages.registerCompletionItemProvider(lang, {
          provideCompletionItems(model, pos) {
            const word  = model.getWordUntilPosition(pos);
            const range = { startLineNumber:pos.lineNumber, endLineNumber:pos.lineNumber,
                            startColumn:word.startColumn, endColumn:word.endColumn };
            return {
              suggestions: SNIPPETS_JS.map(s => ({
                label:           s.label,
                kind:            monaco.languages.CompletionItemKind.Snippet,
                detail:          '🧮 DSA Forge — ' + s.detail,
                insertText:      s.insertText,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range,
              })),
            };
          },
        })
      );
    });
  }

  function deactivate() {
    _disposables.forEach(d => d.dispose()); _disposables = [];
    document.getElementById('ext-dsa-btn')?.remove();
  }

  function getQuickStart() {
    return {
      icon:     '🧮',
      title:    'DSA Forge',
      subtitle: '50+ DSA & competitive programming snippets + algorithm reference',
      steps: [
        { title: 'Insert a Snippet', desc: 'Type <kbd>dsa</kbd> in any JS/TS/C++/Python file to see the full snippet list in IntelliSense.' },
        { title: 'Open Reference Panel', desc: 'Click the <strong>🧮 DSA</strong> toolbar button for the algorithm cheatsheet with time/space complexities.' },
        { title: 'Snippets Include', desc: 'Binary Search, BFS/DFS, Merge Sort, DP memoization, Stack, Queue, MinHeap, Union-Find, Trie, Sliding Window, Two Pointers.' },
      ],
      shortcuts: [
        { keys: 'dsa + Tab',        desc: 'Expand DSA snippet from suggestions' },
        { keys: '🧮 toolbar button', desc: 'Open algorithm reference panel'     },
      ],
      commands: [{ name: 'dsa.panel', desc: 'Open DSA reference panel' }],
      tips: [
        'All snippets expand with Tab-stop placeholders — fill in variable names one by one.',
        'The reference panel shows Time (T) and Space (S) complexity for 10 key algorithms.',
      ],
      onStart: _openPanel,
    };
  }

  return {
    id: 'dsa-forge',
    activate, deactivate, getQuickStart,
    commands: [{ id: 'dsa.panel', label: 'DSA Forge: Open Reference Panel', run: _openPanel }],
  };
})();

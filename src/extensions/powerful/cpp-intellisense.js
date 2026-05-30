/**
 * C/C++ IntelliSense  — Phase 4 Extension
 * STL headers, algorithms, patterns, POSIX APIs, standard functions.
 */
"use strict";

window._exts = window._exts || {};
window._exts['cpp-intellisense'] = {
  id:   'cpp-intellisense',
  name: 'C/C++ IntelliSense',
  icon: '⚙️',
  desc: 'STL headers, algorithms, smart pointers, common C++ patterns',
  version: '1.0.0',
  category: 'IntelliSense',

  activate(ctx) {
    document.addEventListener('monaco-ready', () => _register(ctx));
  },
};

function _register(ctx) {
  if (typeof monaco === 'undefined') return;

  // ── STL headers & typical includes ─────────────────────────────────────
  const _headers = [
    // I/O
    { label: '#include <iostream>',       insertText: '#include <iostream>',     detail: 'std::cout, cin, cerr' },
    { label: '#include <fstream>',        insertText: '#include <fstream>',      detail: 'std::ifstream, ofstream' },
    { label: '#include <sstream>',        insertText: '#include <sstream>',      detail: 'std::stringstream' },
    { label: '#include <iomanip>',        insertText: '#include <iomanip>',      detail: 'std::setw, setprecision' },
    // Containers
    { label: '#include <vector>',         insertText: '#include <vector>',       detail: 'std::vector' },
    { label: '#include <array>',          insertText: '#include <array>',        detail: 'std::array' },
    { label: '#include <list>',           insertText: '#include <list>',         detail: 'std::list, forward_list' },
    { label: '#include <deque>',          insertText: '#include <deque>',        detail: 'std::deque' },
    { label: '#include <map>',            insertText: '#include <map>',          detail: 'std::map, multimap' },
    { label: '#include <unordered_map>',  insertText: '#include <unordered_map>',detail: 'std::unordered_map' },
    { label: '#include <set>',            insertText: '#include <set>',          detail: 'std::set, multiset' },
    { label: '#include <unordered_set>',  insertText: '#include <unordered_set>',detail: 'std::unordered_set' },
    { label: '#include <queue>',          insertText: '#include <queue>',        detail: 'std::queue, priority_queue' },
    { label: '#include <stack>',          insertText: '#include <stack>',        detail: 'std::stack' },
    { label: '#include <bitset>',         insertText: '#include <bitset>',       detail: 'std::bitset' },
    // String & utility
    { label: '#include <string>',         insertText: '#include <string>',       detail: 'std::string' },
    { label: '#include <string_view>',    insertText: '#include <string_view>',  detail: 'std::string_view' },
    { label: '#include <utility>',        insertText: '#include <utility>',      detail: 'std::pair, move, swap' },
    { label: '#include <tuple>',          insertText: '#include <tuple>',        detail: 'std::tuple, get, tie' },
    { label: '#include <optional>',       insertText: '#include <optional>',     detail: 'std::optional' },
    { label: '#include <variant>',        insertText: '#include <variant>',      detail: 'std::variant' },
    { label: '#include <any>',            insertText: '#include <any>',          detail: 'std::any' },
    // Algorithm & numeric
    { label: '#include <algorithm>',      insertText: '#include <algorithm>',    detail: 'std::sort, find, etc.' },
    { label: '#include <numeric>',        insertText: '#include <numeric>',      detail: 'std::accumulate, iota' },
    { label: '#include <functional>',     insertText: '#include <functional>',   detail: 'std::function, bind' },
    { label: '#include <iterator>',       insertText: '#include <iterator>',     detail: 'std::back_inserter' },
    // Memory
    { label: '#include <memory>',         insertText: '#include <memory>',       detail: 'std::unique_ptr, shared_ptr' },
    { label: '#include <memory_resource>',insertText: '#include <memory_resource>', detail: 'std::pmr' },
    // Thread & sync
    { label: '#include <thread>',         insertText: '#include <thread>',       detail: 'std::thread' },
    { label: '#include <mutex>',          insertText: '#include <mutex>',        detail: 'std::mutex, lock_guard' },
    { label: '#include <condition_variable>', insertText: '#include <condition_variable>', detail: 'std::condition_variable' },
    { label: '#include <atomic>',         insertText: '#include <atomic>',       detail: 'std::atomic' },
    { label: '#include <future>',         insertText: '#include <future>',       detail: 'std::future, promise, async' },
    // Misc
    { label: '#include <cmath>',          insertText: '#include <cmath>',        detail: 'sqrt, pow, sin, cos' },
    { label: '#include <cstdlib>',        insertText: '#include <cstdlib>',      detail: 'malloc, free, rand, exit' },
    { label: '#include <cstring>',        insertText: '#include <cstring>',      detail: 'memcpy, strlen, strcmp' },
    { label: '#include <cassert>',        insertText: '#include <cassert>',      detail: 'assert macro' },
    { label: '#include <cstdint>',        insertText: '#include <cstdint>',      detail: 'int32_t, uint64_t, etc.' },
    { label: '#include <climits>',        insertText: '#include <climits>',      detail: 'INT_MAX, INT_MIN' },
    { label: '#include <chrono>',         insertText: '#include <chrono>',       detail: 'std::chrono timing' },
    { label: '#include <regex>',          insertText: '#include <regex>',        detail: 'std::regex' },
    { label: '#include <filesystem>',     insertText: '#include <filesystem>',   detail: 'std::filesystem::path' },
    { label: '#include <format>',         insertText: '#include <format>',       detail: 'std::format (C++20)' },
    { label: '#include <span>',           insertText: '#include <span>',         detail: 'std::span (C++20)' },
    { label: '#include <ranges>',         insertText: '#include <ranges>',       detail: 'std::ranges (C++20)' },
  ];

  // ── STL patterns (code completions) ────────────────────────────────────
  const _stlPatterns = [
    // Algorithms
    { label: 'std::sort', insertText: 'std::sort(${1:v}.begin(), ${1:v}.end()${2:, [](const auto& a, const auto& b){ return a < b; }});', detail: 'sort container' },
    { label: 'std::find', insertText: 'auto ${1:it} = std::find(${2:v}.begin(), ${2:v}.end(), ${3:val});\nif (${1:it} != ${2:v}.end()) { ${4:/* found */} }', detail: 'find element' },
    { label: 'std::find_if', insertText: 'auto ${1:it} = std::find_if(${2:v}.begin(), ${2:v}.end(), [](const auto& ${3:x}) { return ${4:x > 0}; });', detail: 'find with predicate' },
    { label: 'std::transform', insertText: 'std::transform(${1:src}.begin(), ${1:src}.end(), std::back_inserter(${2:dst}), [](const auto& ${3:x}) { return ${4:x}; });', detail: 'transform container' },
    { label: 'std::accumulate', insertText: 'auto ${1:sum} = std::accumulate(${2:v}.begin(), ${2:v}.end(), ${3:0}${4:, [](auto acc, auto x){ return acc + x; }});', detail: 'accumulate/fold' },
    { label: 'std::count_if', insertText: 'auto ${1:n} = std::count_if(${2:v}.begin(), ${2:v}.end(), [](const auto& ${3:x}) { return ${4:x > 0}; });', detail: 'count with predicate' },
    { label: 'std::remove_if', insertText: '${1:v}.erase(std::remove_if(${1:v}.begin(), ${1:v}.end(), [](const auto& ${2:x}) { return ${3:cond}; }), ${1:v}.end());', detail: 'erase-remove idiom' },
    { label: 'std::copy', insertText: 'std::copy(${1:src}.begin(), ${1:src}.end(), std::back_inserter(${2:dst}));', detail: 'copy range' },
    { label: 'std::for_each', insertText: 'std::for_each(${1:v}.begin(), ${1:v}.end(), [](auto& ${2:x}) { ${3:/* process x */} });', detail: 'for_each' },
    { label: 'std::min_element', insertText: 'auto ${1:it} = std::min_element(${2:v}.begin(), ${2:v}.end());\nif (${1:it} != ${2:v}.end()) { auto ${3:min} = *${1:it}; }', detail: 'find minimum' },
    { label: 'std::max_element', insertText: 'auto ${1:it} = std::max_element(${2:v}.begin(), ${2:v}.end());', detail: 'find maximum' },
    // Containers
    { label: 'vector push_back', insertText: '${1:vec}.push_back(${2:val});', detail: 'vector append' },
    { label: 'vector emplace_back', insertText: '${1:vec}.emplace_back(${2:args});', detail: 'vector emplace' },
    { label: 'vector reserve', insertText: '${1:vec}.reserve(${2:n});', detail: 'vector reserve capacity' },
    { label: 'map insert', insertText: '${1:m}.insert({${2:key}, ${3:val}});', detail: 'map insert' },
    { label: 'map find', insertText: 'auto ${1:it} = ${2:m}.find(${3:key});\nif (${1:it} != ${2:m}.end()) { auto ${4:val} = ${1:it}->second; }', detail: 'map find' },
    { label: 'map emplace', insertText: '${1:m}.emplace(${2:key}, ${3:val});', detail: 'map emplace' },
    { label: 'string_format', insertText: 'std::string ${1:s} = std::format("${2:{}}", ${3:val});', detail: 'C++20 format' },
    { label: 'string_stream', insertText: 'std::ostringstream ${1:oss};\n${1:oss} << ${2:val};\nstd::string ${3:s} = ${1:oss}.str();', detail: 'string stream' },
    // Smart pointers
    { label: 'make_unique', insertText: 'auto ${1:ptr} = std::make_unique<${2:Type}>(${3:args});', detail: 'unique_ptr factory' },
    { label: 'make_shared', insertText: 'auto ${1:ptr} = std::make_shared<${2:Type}>(${3:args});', detail: 'shared_ptr factory' },
    // Threading
    { label: 'std::thread', insertText: 'std::thread ${1:t}([${2:&}]() {\n\t${3:// run in thread}\n});\n${1:t}.join();', detail: 'thread' },
    { label: 'std::async', insertText: 'auto ${1:fut} = std::async(std::launch::async, [${2:&}]() {\n\treturn ${3:result};\n});\nauto ${4:val} = ${1:fut}.get();', detail: 'async task' },
    { label: 'lock_guard', insertText: 'std::lock_guard<std::mutex> ${1:lock}(${2:mtx});', detail: 'scoped mutex lock' },
    { label: 'unique_lock', insertText: 'std::unique_lock<std::mutex> ${1:lock}(${2:mtx});', detail: 'flexible mutex lock' },
    // Common patterns
    { label: 'RAII class', insertText: 'class ${1:Resource} {\npublic:\n\t${1:Resource}() { ${2:// acquire} }\n\t~${1:Resource}() noexcept { ${3:// release} }\n\n\t${1:Resource}(const ${1:Resource}&) = delete;\n\t${1:Resource}& operator=(const ${1:Resource}&) = delete;\n\t${1:Resource}(${1:Resource}&&) = default;\n\t${1:Resource}& operator=(${1:Resource}&&) = default;\n};', detail: 'RAII resource class' },
    { label: 'Singleton', insertText: 'class ${1:Singleton} {\npublic:\n\tstatic ${1:Singleton}& instance() {\n\t\tstatic ${1:Singleton} inst;\n\t\treturn inst;\n\t}\n\t${1:Singleton}(const ${1:Singleton}&) = delete;\n\t${1:Singleton}& operator=(const ${1:Singleton}&) = delete;\nprivate:\n\t${1:Singleton}() = default;\n};', detail: 'Singleton pattern' },
    { label: 'filesystem::path', insertText: 'namespace fs = std::filesystem;\nfs::path ${1:p}("${2:path}");\nif (fs::exists(${1:p})) {\n\t${3}\n}', detail: 'filesystem operations' },
  ];

  // ── Register provider for C and C++ ─────────────────────────────────────
  const allItems = [..._headers, ..._stlPatterns];
  ['c', 'cpp'].forEach(lang => {
    monaco.languages.registerCompletionItemProvider(lang, {
      triggerCharacters: ['#', '<', ':', '.'],
      provideCompletionItems(model, position) {
        const word  = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
          startColumn: word.startColumn, endColumn: word.endColumn,
        };
        return {
          suggestions: allItems.map(item => ({
            label: item.label,
            kind:  item.label.startsWith('#include') ?
                     monaco.languages.CompletionItemKind.Module :
                     monaco.languages.CompletionItemKind.Snippet,
            detail: item.detail,
            insertText: item.insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            sortText: item.label.startsWith('#') ? 'a' + item.label : 'b' + item.label,
            range,
          })),
        };
      },
    });
  });

  // ── C/C++ hover docs ──────────────────────────────────────────────────────
  const _cHover = {
    'printf':   '**printf(format, ...)**\nPrints formatted output to stdout. Returns number of characters written.',
    'malloc':   '**malloc(size)**\nAllocates `size` bytes of uninitialized memory. Returns pointer or NULL.',
    'free':     '**free(ptr)**\nDeallocates memory previously allocated by malloc/calloc/realloc.',
    'memcpy':   '**memcpy(dest, src, n)**\nCopies `n` bytes from `src` to `dest`. Regions must not overlap.',
    'memmove':  '**memmove(dest, src, n)**\nCopies `n` bytes, correctly handling overlapping regions.',
    'strlen':   '**strlen(s)**\nReturns the length of the null-terminated string `s`.',
    'strcmp':   '**strcmp(s1, s2)**\nCompares two strings. Returns 0 if equal, <0 if s1 < s2, >0 if s1 > s2.',
    'strncpy':  '**strncpy(dest, src, n)**\nCopies at most `n` characters from `src` to `dest`.',
    'atoi':     '**atoi(s)**\nConverts string to integer. Use strtol for safer conversion.',
    'fopen':    '**fopen(path, mode)**\nOpens a file. Mode: "r", "w", "a", "rb", "wb". Returns FILE* or NULL.',
    'fclose':   '**fclose(fp)**\nCloses the file stream and flushes buffers.',
    'fprintf':  '**fprintf(stream, format, ...)**\nPrints formatted output to a FILE stream.',
    'fscanf':   '**fscanf(stream, format, ...)**\nReads formatted input from a FILE stream.',
    'exit':     '**exit(status)**\nTerminates the process. Status 0 = success, non-zero = error.',
    'assert':   '**assert(expr)**\nAborts the program if `expr` evaluates to false. Disabled in release builds.',
  };

  ['c', 'cpp'].forEach(lang => {
    monaco.languages.registerHoverProvider(lang, {
      provideHover(model, position) {
        const word = model.getWordAtPosition(position);
        if (!word) return null;
        const doc = _cHover[word.word];
        if (!doc) return null;
        return {
          range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
          contents: [{ value: doc }],
        };
      },
    });
  });
}

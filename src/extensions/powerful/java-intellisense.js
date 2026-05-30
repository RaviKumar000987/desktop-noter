/**
 * Java IntelliSense  — Phase 4 Extension
 * Java stdlib, common patterns, Spring Boot, JUnit, Stream API, Maven snippets.
 */
"use strict";

window._exts = window._exts || {};
window._exts['java-intellisense'] = {
  id:   'java-intellisense',
  name: 'Java IntelliSense',
  icon: '☕',
  desc: 'Java stdlib, Stream API, Spring Boot, JUnit, Lombok patterns',
  version: '1.0.0',
  category: 'IntelliSense',

  activate(ctx) {
    document.addEventListener('monaco-ready', () => _register(ctx));
  },
};

function _register(ctx) {
  if (typeof monaco === 'undefined') return;

  // ── Common Java imports ──────────────────────────────────────────────────
  const _imports = [
    { label: 'import java.util.*',           insertText: 'import java.util.*;', detail: 'java.util' },
    { label: 'import java.util.List',        insertText: 'import java.util.List;', detail: 'List' },
    { label: 'import java.util.ArrayList',   insertText: 'import java.util.ArrayList;', detail: 'ArrayList' },
    { label: 'import java.util.HashMap',     insertText: 'import java.util.HashMap;', detail: 'HashMap' },
    { label: 'import java.util.HashSet',     insertText: 'import java.util.HashSet;', detail: 'HashSet' },
    { label: 'import java.util.Optional',    insertText: 'import java.util.Optional;', detail: 'Optional' },
    { label: 'import java.util.Arrays',      insertText: 'import java.util.Arrays;', detail: 'Arrays' },
    { label: 'import java.util.Collections', insertText: 'import java.util.Collections;', detail: 'Collections' },
    { label: 'import java.util.stream.*',    insertText: 'import java.util.stream.*;', detail: 'Stream API' },
    { label: 'import java.util.stream.Collectors', insertText: 'import java.util.stream.Collectors;', detail: 'Collectors' },
    { label: 'import java.io.*',             insertText: 'import java.io.*;', detail: 'java.io' },
    { label: 'import java.io.IOException',   insertText: 'import java.io.IOException;', detail: 'IOException' },
    { label: 'import java.io.File',          insertText: 'import java.io.File;', detail: 'File' },
    { label: 'import java.io.FileReader',    insertText: 'import java.io.FileReader;', detail: 'FileReader' },
    { label: 'import java.io.BufferedReader',insertText: 'import java.io.BufferedReader;', detail: 'BufferedReader' },
    { label: 'import java.nio.file.*',       insertText: 'import java.nio.file.*;', detail: 'java.nio.file' },
    { label: 'import java.nio.file.Files',   insertText: 'import java.nio.file.Files;', detail: 'Files NIO' },
    { label: 'import java.nio.file.Paths',   insertText: 'import java.nio.file.Paths;', detail: 'Paths NIO' },
    { label: 'import java.lang.Math',        insertText: 'import java.lang.Math;', detail: 'Math' },
    { label: 'import java.math.BigDecimal',  insertText: 'import java.math.BigDecimal;', detail: 'BigDecimal' },
    { label: 'import java.time.*',           insertText: 'import java.time.*;', detail: 'java.time' },
    { label: 'import java.time.LocalDate',   insertText: 'import java.time.LocalDate;', detail: 'LocalDate' },
    { label: 'import java.time.LocalDateTime',insertText: 'import java.time.LocalDateTime;', detail: 'LocalDateTime' },
    { label: 'import java.net.http.*',       insertText: 'import java.net.http.*;', detail: 'HttpClient' },
    { label: 'import java.net.URI',          insertText: 'import java.net.URI;', detail: 'URI' },
    { label: 'import java.util.concurrent.*',insertText: 'import java.util.concurrent.*;', detail: 'concurrency' },
    { label: 'import java.util.function.*',  insertText: 'import java.util.function.*;', detail: 'functional interfaces' },
    { label: 'import java.util.logging.*',   insertText: 'import java.util.logging.*;', detail: 'logging' },
    // Testing
    { label: 'import org.junit.jupiter.api.*', insertText: 'import org.junit.jupiter.api.*;', detail: 'JUnit 5' },
    { label: 'import org.junit.Test',        insertText: 'import org.junit.Test;', detail: 'JUnit 4' },
    { label: 'import static org.junit.jupiter.api.Assertions.*', insertText: 'import static org.junit.jupiter.api.Assertions.*;', detail: 'JUnit 5 assertions' },
    { label: 'import org.mockito.Mockito.*', insertText: 'import static org.mockito.Mockito.*;', detail: 'Mockito' },
    // Spring
    { label: 'import org.springframework.stereotype.*', insertText: 'import org.springframework.stereotype.*;', detail: 'Spring stereotypes' },
    { label: 'import org.springframework.web.bind.annotation.*', insertText: 'import org.springframework.web.bind.annotation.*;', detail: 'Spring MVC' },
    { label: 'import org.springframework.boot.autoconfigure.SpringBootApplication', insertText: 'import org.springframework.boot.autoconfigure.SpringBootApplication;', detail: 'Spring Boot' },
    // JSON
    { label: 'import com.fasterxml.jackson.databind.*', insertText: 'import com.fasterxml.jackson.databind.*;', detail: 'Jackson JSON' },
    // Lombok
    { label: 'import lombok.Data',           insertText: 'import lombok.Data;', detail: 'Lombok @Data' },
    { label: 'import lombok.Builder',        insertText: 'import lombok.Builder;', detail: 'Lombok @Builder' },
    { label: 'import lombok.RequiredArgsConstructor', insertText: 'import lombok.RequiredArgsConstructor;', detail: 'Lombok constructor' },
    { label: 'import lombok.Slf4j',          insertText: 'import lombok.Slf4j;', detail: 'Lombok @Slf4j' },
  ];

  // ── Java code patterns ──────────────────────────────────────────────────
  const _patterns = [
    // Stream API
    { label: 'stream.filter',    insertText: '${1:list}.stream()\n\t.filter(${2:x} -> ${3:cond})\n\t.collect(Collectors.toList())',  detail: 'Stream filter' },
    { label: 'stream.map',       insertText: '${1:list}.stream()\n\t.map(${2:x} -> ${3:x})\n\t.collect(Collectors.toList())',       detail: 'Stream map' },
    { label: 'stream.mapToInt',  insertText: '${1:list}.stream()\n\t.mapToInt(${2:x} -> ${3:x.size()})\n\t.sum()',                   detail: 'Stream mapToInt' },
    { label: 'stream.sorted',    insertText: '${1:list}.stream()\n\t.sorted(Comparator.comparing(${2:Type::getField}))\n\t.collect(Collectors.toList())', detail: 'Stream sorted' },
    { label: 'stream.distinct',  insertText: '${1:list}.stream().distinct().collect(Collectors.toList())', detail: 'Stream distinct' },
    { label: 'stream.count',     insertText: 'long ${1:n} = ${2:list}.stream().filter(${3:x} -> ${4:cond}).count();', detail: 'Stream count' },
    { label: 'stream.findFirst', insertText: 'Optional<${1:Type}> ${2:opt} = ${3:list}.stream().filter(${4:x} -> ${5:cond}).findFirst();', detail: 'Stream findFirst' },
    { label: 'stream.anyMatch',  insertText: 'boolean ${1:found} = ${2:list}.stream().anyMatch(${3:x} -> ${4:cond});', detail: 'Stream anyMatch' },
    { label: 'stream.groupingBy',insertText: 'Map<${1:Key}, List<${2:Val}>> ${3:grouped} = ${4:list}.stream()\n\t.collect(Collectors.groupingBy(${5:x} -> ${6:x.getKey()}));', detail: 'Stream groupingBy' },
    { label: 'stream.joining',   insertText: 'String ${1:s} = ${2:list}.stream().collect(Collectors.joining("${3:, }"));', detail: 'Stream joining' },
    { label: 'stream.reduce',    insertText: 'Optional<${1:Type}> ${2:res} = ${3:list}.stream().reduce((${4:a}, ${5:b}) -> ${6:a + b});', detail: 'Stream reduce' },
    // Optional
    { label: 'Optional.of',      insertText: 'Optional<${1:Type}> ${2:opt} = Optional.ofNullable(${3:val});', detail: 'Optional.ofNullable' },
    { label: 'opt.orElse',       insertText: '${1:opt}.orElse(${2:defaultVal})', detail: 'Optional orElse' },
    { label: 'opt.orElseThrow',  insertText: '${1:opt}.orElseThrow(() -> new ${2:RuntimeException}("${3:Not found}"))', detail: 'Optional orElseThrow' },
    { label: 'opt.ifPresent',    insertText: '${1:opt}.ifPresent(${2:val} -> ${3:// use val});', detail: 'Optional ifPresent' },
    { label: 'opt.map',          insertText: '${1:opt}.map(${2:x} -> ${3:x.toString()})', detail: 'Optional map' },
    // Collections
    { label: 'List.of',          insertText: 'List.of(${1:el1}, ${2:el2})', detail: 'Immutable list' },
    { label: 'Map.of',           insertText: 'Map.of("${1:key1}", ${2:val1}, "${3:key2}", ${4:val2})', detail: 'Immutable map' },
    { label: 'Map.entry',        insertText: 'Map.entry("${1:key}", ${2:val})', detail: 'Map.Entry' },
    { label: 'Collections.sort', insertText: 'Collections.sort(${1:list}${2:, Comparator.comparing(${3:x} -> ${4:x.getName()})});', detail: 'Collections.sort' },
    { label: 'Arrays.asList',    insertText: 'Arrays.asList(${1:el1}, ${2:el2})', detail: 'Arrays.asList' },
    { label: 'new ArrayList',    insertText: 'new ArrayList<>(${1:List.of(${2:elems})})', detail: 'Mutable ArrayList' },
    // File I/O
    { label: 'Files.readString', insertText: 'String ${1:content} = Files.readString(Paths.get("${2:path}"));', detail: 'NIO read file' },
    { label: 'Files.writeString',insertText: 'Files.writeString(Paths.get("${1:path}"), ${2:content});', detail: 'NIO write file' },
    { label: 'Files.lines',      insertText: 'Files.lines(Paths.get("${1:path}")).forEach(${2:System.out::println});', detail: 'NIO read lines' },
    { label: 'BufferedReader',   insertText: 'try (BufferedReader ${1:br} = new BufferedReader(new FileReader("${2:file}"))) {\n\tString ${3:line};\n\twhile ((${3:line} = ${1:br}.readLine()) != null) {\n\t\t${4:System.out.println(line);}\n\t}\n}', detail: 'BufferedReader pattern' },
    // Concurrency
    { label: 'CompletableFuture', insertText: 'CompletableFuture<${1:String}> ${2:future} = CompletableFuture\n\t.supplyAsync(() -> ${3:// async work})\n\t.thenApply(${4:x} -> ${5:x.toUpperCase()});\nString ${6:result} = ${2:future}.get();', detail: 'CompletableFuture chain' },
    { label: 'ExecutorService',  insertText: 'ExecutorService ${1:exec} = Executors.newFixedThreadPool(${2:4});\ntry {\n\t${1:exec}.submit(() -> {\n\t\t${3:// task}\n\t});\n} finally {\n\t${1:exec}.shutdown();\n}', detail: 'ExecutorService' },
    // Spring Boot
    { label: '@SpringBootApp',   insertText: '@SpringBootApplication\npublic class ${1:Application} {\n\tpublic static void main(String[] args) {\n\t\tSpringApplication.run(${1:Application}.class, args);\n\t}\n}', detail: 'Spring Boot entry' },
    { label: '@RestController',  insertText: '@RestController\n@RequestMapping("/${1:api}")\npublic class ${2:Controller} {\n\n\t@GetMapping("/")\n\tpublic ResponseEntity<?> ${3:get}() {\n\t\treturn ResponseEntity.ok(${4:Map.of("ok", true)});\n\t}\n}', detail: 'REST controller' },
    { label: '@Service',         insertText: '@Service\npublic class ${1:Service} {\n\n\tpublic ${2:Object} ${3:process}(${4:params}) {\n\t\t${5}\n\t}\n}', detail: 'Spring service' },
    { label: '@Entity',          insertText: '@Entity\n@Table(name = "${1:table}")\npublic class ${2:Entity} {\n\t@Id\n\t@GeneratedValue(strategy = GenerationType.IDENTITY)\n\tprivate Long id;\n\n\t${3:// fields}\n}', detail: 'JPA entity' },
    // JUnit 5
    { label: '@Test',            insertText: '@Test\nvoid ${1:test_name}() {\n\t// Arrange\n\t${2}\n\t// Act\n\t// Assert\n\tassertEquals(${3:expected}, ${4:actual});\n}', detail: 'JUnit 5 test' },
    { label: '@BeforeEach',      insertText: '@BeforeEach\nvoid ${1:setUp}() {\n\t${2}\n}', detail: 'JUnit 5 setup' },
    { label: '@ParameterizedTest', insertText: '@ParameterizedTest\n@ValueSource(${1:strings} = {"${2:val1}", "${3:val2}"})\nvoid ${4:test}(${5:String} ${6:input}) {\n\t${7}\n}', detail: 'Parameterized test' },
    // Lombok
    { label: '@Data',            insertText: '@Data\npublic class ${1:Name} {\n\tprivate ${2:String} ${3:field};\n}', detail: 'Lombok @Data bean' },
    { label: '@Builder',         insertText: '@Builder\n@Data\npublic class ${1:Name} {\n\tprivate ${2:String} ${3:field};\n}', detail: 'Lombok @Builder' },
    // Design patterns
    { label: 'Builder pattern',  insertText: 'public class ${1:Name} {\n\tprivate final ${2:String} ${3:field};\n\n\tprivate ${1:Name}(Builder builder) {\n\t\tthis.${3:field} = builder.${3:field};\n\t}\n\n\tpublic static class Builder {\n\t\tprivate ${2:String} ${3:field};\n\n\t\tpublic Builder ${3:field}(${2:String} val) {\n\t\t\tthis.${3:field} = val; return this;\n\t\t}\n\n\t\tpublic ${1:Name} build() { return new ${1:Name}(this); }\n\t}\n}', detail: 'Builder pattern' },
    { label: 'Singleton',        insertText: 'public class ${1:Singleton} {\n\tprivate static volatile ${1:Singleton} instance;\n\n\tprivate ${1:Singleton}() {}\n\n\tpublic static ${1:Singleton} getInstance() {\n\t\tif (instance == null) {\n\t\t\tsynchronized (${1:Singleton}.class) {\n\t\t\t\tif (instance == null) instance = new ${1:Singleton}();\n\t\t\t}\n\t\t}\n\t\treturn instance;\n\t}\n}', detail: 'Thread-safe Singleton' },
  ];

  // ── Register provider ────────────────────────────────────────────────────
  const allItems = [..._imports, ..._patterns];

  monaco.languages.registerCompletionItemProvider('java', {
    triggerCharacters: ['.', 'i', '@', '<'],
    provideCompletionItems(model, position) {
      const word  = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
        startColumn: word.startColumn, endColumn: word.endColumn,
      };
      return {
        suggestions: allItems.map(item => ({
          label: item.label,
          kind:  item.label.startsWith('import') ?
                   monaco.languages.CompletionItemKind.Module :
                   item.label.startsWith('@') ?
                   monaco.languages.CompletionItemKind.Event :
                   monaco.languages.CompletionItemKind.Snippet,
          detail: item.detail || 'Java',
          insertText: item.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          sortText: item.label.startsWith('import') ? 'a' + item.label : 'b' + item.label,
          range,
        })),
      };
    },
  });

  // ── Java hover docs ──────────────────────────────────────────────────────
  const _javaHover = {
    'System':      '**java.lang.System**\nProvides access to stdin, stdout, stderr, environment, and system properties.',
    'String':      '**java.lang.String**\nImmutable sequence of characters. Use StringBuilder for mutable string building.',
    'StringBuilder': '**java.lang.StringBuilder**\nMutable sequence of characters for efficient string building.',
    'Integer':     '**java.lang.Integer**\nWrapper class for int. Provides parseInt, MAX_VALUE, MIN_VALUE, etc.',
    'ArrayList':   '**java.util.ArrayList**\nResizable array-based List implementation. O(1) random access, O(n) insert/remove.',
    'HashMap':     '**java.util.HashMap**\nHash table-based Map. O(1) average for get/put. Not thread-safe.',
    'Optional':    '**java.util.Optional**\nContainer that may or may not contain a value. Use to avoid null checks.',
    'Stream':      '**java.util.stream.Stream**\nSupports functional-style operations on sequences of elements.',
    'Collectors':  '**java.util.stream.Collectors**\nFactory for reduction operations (toList, groupingBy, joining, etc.).',
    'CompletableFuture': '**java.util.concurrent.CompletableFuture**\nFuture that can be explicitly completed. Supports async pipeline with thenApply, thenAccept, etc.',
    'Objects':     '**java.util.Objects**\nUtility methods for objects: requireNonNull, equals, hash, toString.',
    'Arrays':      '**java.util.Arrays**\nMethods for manipulating arrays: sort, binarySearch, fill, copyOf, asList.',
    'Collections': '**java.util.Collections**\nMethods for working with collections: sort, reverse, shuffle, unmodifiableList.',
    'Files':       '**java.nio.file.Files**\nFile utility methods: read, write, copy, delete, exists, list, walk.',
    'Paths':       '**java.nio.file.Paths**\nFactory for Path objects. Use Paths.get() to create paths.',
  };

  monaco.languages.registerHoverProvider('java', {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const doc = _javaHover[word.word];
      if (!doc) return null;
      return {
        range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
        contents: [{ value: doc }],
      };
    },
  });
}

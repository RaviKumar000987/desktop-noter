// ═══════════════════════════════════════════════════════════════
//  EXTENSIONS RUNTIME — compatibility stub
//  The real runtime lives in extensions/index.js.
//  This file is kept so any legacy references to ExtensionRuntime
//  still resolve correctly.
// ═══════════════════════════════════════════════════════════════
//
//  All 20 official extensions are loaded individually:
//    src/renderer/extensions/*.js
//  The runtime loader that activates them is:
//    src/renderer/extensions/index.js
//
//  NOTE: index.html loads extensions/index.js AFTER all extension
//  files, so window._exts is fully populated before activation.
// ═══════════════════════════════════════════════════════════════

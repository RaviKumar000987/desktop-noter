"use strict";
/**
 * NOTER — Crash Recovery System
 *
 * Periodically snapshots the editor session (tabs + unsaved content) to
 * localStorage.  On startup, detects an abnormal exit and offers to restore.
 *
 * Integration flow (in app.js Monaco-ready callback):
 *   1. const snap = CrashRecovery.checkCrash();   // clears clean-exit flag
 *   2. if (snap) CrashRecovery.showRecoveryDialog(snap, onRestore, onDismiss);
 *   3. CrashRecovery.start();                      // begin periodic snapshots
 *   4. window.addEventListener('beforeunload', () => CrashRecovery.markCleanExit());
 */
const CrashRecovery = (() => {
  const KEY_SNAPS   = "noter.crash.snapshots";
  const KEY_CLEAN   = "noter.clean-exit";
  const INTERVAL_MS = 30_000;   // auto-save every 30 s
  const MAX_SNAPS   = 3;        // keep at most 3 rolling snapshots

  let _intervalId = null;

  // ── Snapshot storage ──────────────────────────────────────────────────────

  function _readSnaps() {
    try { return JSON.parse(localStorage.getItem(KEY_SNAPS) || "[]"); }
    catch { return []; }
  }

  function _writeSnaps(arr) {
    try { localStorage.setItem(KEY_SNAPS, JSON.stringify(arr.slice(0, MAX_SNAPS))); }
    catch { /* quota exceeded — skip */ }
  }

  function _buildSnapshot() {
    if (typeof TabManager === "undefined") return null;

    const tabs = TabManager.tabs.map(t => ({
      filePath:   t.filePath ?? null,
      title:      t.title,
      language:   t.language,
      isActive:   t.id === TabManager.activeId,
      isModified: t.isModified,
      // Only persist content for files with unsaved changes
      content:    t.isModified ? (t.model?.getValue?.() ?? "") : null,
    }));

    // Don't bother snapshotting a blank/empty session
    if (!tabs.some(t => t.filePath || t.content)) return null;

    const wsRoot = (typeof explorerState !== "undefined" && explorerState.rootPath)
      ? explorerState.rootPath : null;

    return { timestamp: Date.now(), workspaceRoot: wsRoot, tabs };
  }

  function _doSnapshot() {
    const snap = _buildSnapshot();
    if (snap) _writeSnaps([snap, ..._readSnaps()]);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Begin the periodic auto-snapshot timer. */
  function start() {
    if (_intervalId) return;
    _intervalId = setInterval(_doSnapshot, INTERVAL_MS);

    // Extra snapshot when the user switches away (possible unclean close)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) _doSnapshot();
    }, { passive: true });
  }

  function stop() {
    clearInterval(_intervalId);
    _intervalId = null;
  }

  /** Call in beforeunload to signal a clean exit. */
  function markCleanExit() {
    try { localStorage.setItem(KEY_CLEAN, "1"); } catch { /* ignore */ }
  }

  /**
   * Call once at startup, BEFORE restoreSessionState().
   * Returns the latest crash snapshot if an abnormal exit is detected,
   * or null if the previous exit was clean / no snapshot exists.
   * Also clears the clean-exit flag so a crash is detected next time.
   */
  function checkCrash() {
    const wasClean = localStorage.getItem(KEY_CLEAN) === "1";
    try { localStorage.removeItem(KEY_CLEAN); } catch { /* ignore */ }

    if (wasClean) return null;

    const snaps = _readSnaps();
    if (!snaps.length) return null;

    const latest = snaps[0];
    const ageMs  = Date.now() - (latest.timestamp || 0);
    if (ageMs > 24 * 3_600_000) return null;  // older than 24 h — ignore

    return latest;
  }

  function clearSnapshots() {
    try { localStorage.removeItem(KEY_SNAPS); } catch { /* ignore */ }
  }

  // ── Recovery dialog ───────────────────────────────────────────────────────

  function _escHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /**
   * Render a modal recovery dialog.
   * @param {object}   snapshot   — from checkCrash()
   * @param {Function} onRestore  — called with snapshot when user clicks Restore
   * @param {Function} onDismiss  — called when user clicks Start Fresh
   */
  function showRecoveryDialog(snapshot, onRestore, onDismiss) {
    document.getElementById("noter-recovery-overlay")?.remove();

    const tabRows = snapshot.tabs.slice(0, 6).map(t => `
      <div class="nr-tab-row">
        <span class="nr-tab-icon">📄</span>
        <span class="nr-tab-name">${_escHtml(t.title || "Untitled")}</span>
        ${t.isModified ? '<span class="nr-badge">Unsaved changes</span>' : ""}
      </div>`).join("");

    const moreLine = snapshot.tabs.length > 6
      ? `<p class="nr-more">…and ${snapshot.tabs.length - 6} more tab(s)</p>` : "";

    const overlay = document.createElement("div");
    overlay.id = "noter-recovery-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Session Recovery");

    overlay.innerHTML = `
      <div class="nr-dialog">
        <div class="nr-dialog-icon" aria-hidden="true">⚠</div>
        <h2 class="nr-dialog-title">Recover Previous Session?</h2>
        <p class="nr-dialog-desc">
          Noter closed unexpectedly.
          <strong>${snapshot.tabs.length} tab${snapshot.tabs.length !== 1 ? "s" : ""}</strong>
          can be recovered.
        </p>
        <div class="nr-tabs-list">${tabRows}${moreLine}</div>
        <p class="nr-dialog-ts">Snapshot saved ${new Date(snapshot.timestamp).toLocaleString()}</p>
        <div class="nr-dialog-actions">
          <button class="nr-btn nr-btn-primary"   id="nr-btn-restore">Restore Session</button>
          <button class="nr-btn nr-btn-secondary"  id="nr-btn-dismiss">Start Fresh</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    document.getElementById("nr-btn-restore").focus();

    document.getElementById("nr-btn-restore").onclick = () => {
      overlay.remove();
      onRestore(snapshot);
    };
    document.getElementById("nr-btn-dismiss").onclick = () => {
      overlay.remove();
      clearSnapshots();
      onDismiss?.();
    };
  }

  /**
   * Restore tabs from a crash snapshot.
   * Closes all current tabs, optionally reloads the workspace folder,
   * then recreates each tab (reading file content from disk where needed).
   */
  async function restoreSnapshot(snapshot) {
    if (typeof TabManager === "undefined") return;

    // Close current tabs without prompting
    TabManager._suppressAutoBlank = true;
    [...TabManager.tabs].forEach(t => TabManager.close(t.id, true));
    TabManager._suppressAutoBlank = false;

    // Reload workspace folder in the explorer
    if (snapshot.workspaceRoot && typeof openExplorerFolder === "function") {
      try { await openExplorerFolder(snapshot.workspaceRoot); } catch { /* ignore */ }
    }

    let activatedId = null;
    for (const td of snapshot.tabs) {
      let content = td.content ?? "";

      // Load from disk if not modified / content not stored
      if (!content && td.filePath && window.electronAPI?.openFileByPath) {
        try {
          const res = await window.electronAPI.openFileByPath(td.filePath);
          content   = res?.content ?? "";
        } catch { /* file may have moved */ }
      }

      const tab = TabManager.create(td.filePath, content, td.language);
      if (td.isModified && td.content) tab.isModified = true;
      if (td.isActive && !activatedId) activatedId = tab.id;
    }

    if (activatedId) {
      TabManager.activate(activatedId);
    } else if (TabManager.tabs.length > 0) {
      TabManager.activate(TabManager.tabs[0].id);
    }

    clearSnapshots();

    if (typeof showToast === "function") {
      showToast(
        `Session recovered — ${snapshot.tabs.length} tab(s) restored`,
        "info",
        3500
      );
    }
  }

  return {
    start, stop,
    checkCrash, clearSnapshots, markCleanExit,
    showRecoveryDialog, restoreSnapshot,
  };
})();

window.CrashRecovery = CrashRecovery;

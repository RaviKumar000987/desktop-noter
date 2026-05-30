// ═══════════════════════════════════════════════════════════════
//  ACTIVITY BAR — activity-bar.js
//  VS Code-style left icon strip: Explorer · Search · Extensions · Settings
// ═══════════════════════════════════════════════════════════════

const ActivityBar = (() => {
  const $ = (id) => document.getElementById(id);

  // Which panel is currently active in the sidebar slot
  // 'explorer' | 'search' | 'extensions' | 'settings' | null
  let active = "explorer";

  // ── Helpers ───────────────────────────────────────────────────
  function setActive(panel) {
    active = panel;
    document.querySelectorAll(".ab-btn").forEach((btn) => {
      btn.classList.toggle("ab-active", btn.id === "ab-" + panel);
    });
  }

  function isSidebarVisible() {
    const sb = $("sidebar");
    return sb && !sb.classList.contains("hidden");
  }

  function showSidebar() {
    // toggleSidebar(true) in app.js sets the authoritative sidebarVisible var
    // and handles DOM updates. We only call it if the sidebar is actually hidden.
    if (typeof window.toggleSidebar === "function") {
      window.toggleSidebar(true);
    } else {
      const sb = $("sidebar");
      const rh = $("resize-handle");
      if (sb) sb.classList.remove("hidden");
      if (rh) rh.classList.remove("hidden");
    }
    window.dispatchEvent(new CustomEvent("sidebar-shown"));
  }

  function hideSidebar() {
    // toggleSidebar(false) in app.js sets the authoritative sidebarVisible var.
    if (typeof window.toggleSidebar === "function") {
      window.toggleSidebar(false);
    } else {
      const sb = $("sidebar");
      const rh = $("resize-handle");
      if (sb) sb.classList.add("hidden");
      if (rh) rh.classList.add("hidden");
    }
    window.dispatchEvent(new CustomEvent("sidebar-hidden"));
  }

  function enterExplorerMode() {
    const sb = $("sidebar");
    if (sb) {
      sb.classList.remove("search-mode");
      const title = sb.querySelector(".sidebar-title");
      if (title) title.textContent = "EXPLORER";
    }
    // Hide all non-explorer sidebar panels
    ["search-panel", "project-overview-panel", "code-graph-panel", "ai-chat-panel", "memory-panel", "reasoning-panel"].forEach(id => {
      const el = $(id);
      if (el) el.style.display = "none";
    });

    // Restore explorer panels using app.js state — never blindly clear
    // inline styles, since openExplorerFolder sets them based on whether
    // a folder is open.  Clearing them to "" reverts to CSS defaults and
    // makes the workspace disappear (bug: "folder gone after search click").
    if (typeof window.restoreExplorerView === "function") {
      window.restoreExplorerView();
    }

    $("gs-search-btn")?.classList.remove("gs-active");
  }

  function enterSearchMode() {
    const sb = $("sidebar");
    if (sb) {
      sb.classList.add("search-mode");
      const title = sb.querySelector(".sidebar-title");
      if (title) title.textContent = "SEARCH";
    }
    // Hide phase 2 panels when entering search
    ["project-overview-panel", "code-graph-panel", "ai-chat-panel", "memory-panel", "reasoning-panel"].forEach(id => {
      const el = $(id);
      if (el) el.style.display = "none";
    });
    $("gs-search-btn")?.classList.add("gs-active");
    setTimeout(() => $("gs-input")?.focus(), 80);
  }

  // ── Explorer button ───────────────────────────────────────────
  $("ab-explorer")?.addEventListener("click", () => {
    if (active === "explorer" && isSidebarVisible()) {
      // Second click: collapse sidebar
      hideSidebar();
      setActive(null);
    } else {
      showSidebar();
      enterExplorerMode();
      setActive("explorer");
    }
  });

  // ── Search button ─────────────────────────────────────────────
  $("ab-search")?.addEventListener("click", () => {
    if (active === "search" && isSidebarVisible()) {
      hideSidebar();
      setActive(null);
    } else {
      showSidebar();
      enterSearchMode();
      setActive("search");
    }
  });

  // ── Extensions button ─────────────────────────────────────────
  $("ab-extensions")?.addEventListener("click", () => {
    // Open marketplace panel (handled by marketplace.js)
    $("openMarketplace")?.click();
    // Don't set sidebar active — marketplace is a separate overlay
    setActive("extensions");
    // Reset after a moment so the button doesn't stay lit
    setTimeout(() => {
      if (active === "extensions") setActive(active === "explorer" ? "explorer" : null);
    }, 300);
  });

  // ── AI Chat button ────────────────────────────────────────────
  $("ab-ai")?.addEventListener("click", () => {
    if (active === "ai" && isSidebarVisible()) {
      hideSidebar();
      setActive(null);
    } else {
      showSidebar();
      const sb = $("sidebar");
      if (sb) {
        sb.classList.remove("search-mode");
        const title = sb.querySelector(".sidebar-title");
        if (title) title.textContent = "AI ASSISTANT";
      }
      // Hide other panels
      ["search-panel", "code-graph-panel", "project-overview-panel", "memory-panel", "reasoning-panel"].forEach(id => {
        const el = $(id);
        if (el) el.style.display = "none";
      });
      [$("no-folder-msg"), $("explorer-content")].forEach(el => {
        if (el) el.style.display = "none";
      });
      if (typeof AiChat !== "undefined") {
        AiChat.show();
      }
      setActive("ai");
    }
  });

  // ── Project Overview button ───────────────────────────────────
  $("ab-project")?.addEventListener("click", () => {
    if (active === "project" && isSidebarVisible()) {
      hideSidebar();
      setActive(null);
    } else {
      showSidebar();
      // Update sidebar title
      const sb = $("sidebar");
      if (sb) {
        sb.classList.remove("search-mode");
        const title = sb.querySelector(".sidebar-title");
        if (title) title.textContent = "PROJECT";
      }
      // Hide other sidebar panels and explorer content
      ["search-panel", "code-graph-panel", "memory-panel", "reasoning-panel"].forEach(id => {
        const el = $(id);
        if (el) el.style.display = "none";
      });
      [$("no-folder-msg"), $("explorer-content")].forEach(el => {
        if (el) el.style.display = "none";
      });
      if (typeof ProjectOverview !== "undefined") {
        ProjectOverview.show();
      }
      setActive("project");
    }
  });

  // ── Settings button ───────────────────────────────────────────
  $("ab-settings")?.addEventListener("click", () => {
    if (typeof SettingsUI !== "undefined") {
      const isOpen = document.getElementById("settings-overlay")?.classList.contains("settings-visible");
      if (isOpen) {
        SettingsUI.close();
        // Restore previous panel highlight
        setActive(isSidebarVisible() ? "explorer" : null);
      } else {
        SettingsUI.open();
        setActive("settings");
      }
    }
  });

  // ── Activity bar icon drag-to-reorder ────────────────────────
  (function initActivityBarDnD() {
    const topSlot = document.querySelector('#activity-bar .ab-top');
    if (!topSlot) return;

    let dragSrc = null;

    function attachHandlers(btn) {
      btn.setAttribute('draggable', 'true');
      btn.addEventListener('dragstart',  onDragStart);
      btn.addEventListener('dragend',    onDragEnd);
      btn.addEventListener('dragover',   onDragOver);
      btn.addEventListener('dragleave',  onDragLeave);
      btn.addEventListener('drop',       onDrop);
    }

    function onDragStart(e) {
      dragSrc = this;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', this.id);
      // Delay class so the ghost image captures the un-dimmed button
      setTimeout(() => this.classList.add('ab-dragging'), 0);
    }

    function onDragEnd() {
      this.classList.remove('ab-dragging');
      topSlot.querySelectorAll('.ab-btn').forEach(b => b.classList.remove('ab-drag-over'));
      dragSrc = null;
      _saveOrder();
    }

    function onDragOver(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragSrc && this !== dragSrc) this.classList.add('ab-drag-over');
    }

    function onDragLeave() {
      this.classList.remove('ab-drag-over');
    }

    function onDrop(e) {
      e.stopPropagation();
      e.preventDefault();
      if (!dragSrc || dragSrc === this) return;

      const btns   = [...topSlot.querySelectorAll('.ab-btn')];
      const srcIdx = btns.indexOf(dragSrc);
      const tgtIdx = btns.indexOf(this);

      if (srcIdx < tgtIdx) topSlot.insertBefore(dragSrc, this.nextSibling);
      else                 topSlot.insertBefore(dragSrc, this);

      this.classList.remove('ab-drag-over');
    }

    function _saveOrder() {
      const order = [...topSlot.querySelectorAll('.ab-btn')].map(b => b.id);
      try { localStorage.setItem('noter.activity-bar-order', JSON.stringify(order)); } catch {}
    }

    function _restoreOrder() {
      try {
        const saved = JSON.parse(localStorage.getItem('noter.activity-bar-order') || 'null');
        if (!Array.isArray(saved) || !saved.length) return;
        saved.forEach(id => {
          const btn = document.getElementById(id);
          if (btn && btn.closest('.ab-top') === topSlot) topSlot.appendChild(btn);
        });
      } catch {}
    }

    _restoreOrder();
    topSlot.querySelectorAll('.ab-btn').forEach(attachHandlers);
  })();

  // ── Keep in sync with keyboard shortcut Ctrl+B ───────────────
  // app.js dispatches these when toggling via keyboard/menu
  window.addEventListener("sidebar-hidden", () => {
    if (active !== "search" && active !== "settings") setActive(null);
  });
  window.addEventListener("sidebar-shown", () => {
    if (!active || active === null) setActive("explorer");
  });

  // ── Ctrl+Shift+F shortcut: switch to search panel ────────────
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === "F") {
      if (active !== "search" || !isSidebarVisible()) {
        showSidebar();
        enterSearchMode();
        setActive("search");
      }
    }
    // Ctrl+B: toggle explorer
    if (e.ctrlKey && !e.shiftKey && e.key === "b") {
      // Let app.js handle the logic, just sync the badge
      setTimeout(() => {
        const nowVisible = isSidebarVisible();
        if (nowVisible && active === null) setActive("explorer");
        if (!nowVisible) setActive(null);
      }, 20);
    }
  });

  return {
    setActive,
    getActive: () => active,
  };
})();
window.ActivityBar = ActivityBar;

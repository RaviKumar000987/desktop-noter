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
    const sb = $("sidebar");
    const rh = $("resize-handle");
    if (sb) sb.classList.remove("hidden");
    if (rh) rh.classList.remove("hidden");
    window.dispatchEvent(new CustomEvent("sidebar-shown"));
    // Keep the main sidebar state in sync (app.js uses sidebarVisible var)
    window.sidebarVisible = true;
    const tog = $("sidebar-toggle");
    if (tog) tog.classList.add("active");
  }

  function hideSidebar() {
    const sb = $("sidebar");
    const rh = $("resize-handle");
    if (sb) sb.classList.add("hidden");
    if (rh) rh.classList.add("hidden");
    window.dispatchEvent(new CustomEvent("sidebar-hidden"));
    window.sidebarVisible = false;
    const tog = $("sidebar-toggle");
    if (tog) tog.classList.remove("active");
  }

  function enterExplorerMode() {
    const sb = $("sidebar");
    if (sb) {
      sb.classList.remove("search-mode");
      const title = sb.querySelector(".sidebar-title");
      if (title) title.textContent = "EXPLORER";
    }
    // Hide search panel
    const searchPanel = $("search-panel");
    if (searchPanel) searchPanel.style.display = "none";

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

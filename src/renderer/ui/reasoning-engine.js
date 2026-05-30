// ═══════════════════════════════════════════════════════════════
//  REASONING ENGINE UI — reasoning-engine.js   (Phase 2.3)
//  Pure subscriber. All computation runs in main process.
//  Data flows: main → IPC → renderer renders.
// ═══════════════════════════════════════════════════════════════

const ReasoningEngine = (() => {
  const $ = (id) => document.getElementById(id);

  let _visible   = false;
  let _activeTab = 'overview';
  let _workspace = null;
  let _data      = null;
  let _analyzing = false;
  let _simFile   = '';
  let _simResult = null;

  // ── Public API ─────────────────────────────────────────────────

  function show() {
    _visible   = true;
    _workspace = window.explorerState?.rootPath || null;
    _render();
    const panel = $('reasoning-panel');
    if (panel) { panel.style.display = 'flex'; panel.style.flexDirection = 'column'; }
  }

  function hide() {
    _visible = false;
    const panel = $('reasoning-panel');
    if (panel) panel.style.display = 'none';
  }

  function toggle() { _visible ? hide() : show(); }

  // ── Panel skeleton ─────────────────────────────────────────────

  function _render() {
    const panel = $('reasoning-panel');
    if (!panel) return;
    panel.innerHTML = `
      <div class="re-header">
        <span class="re-title">PROJECT REASONING</span>
        <button class="re-analyze-btn" id="re-analyze">⟳ Analyze</button>
      </div>
      <div class="re-tabs">
        <button class="re-tab ${_activeTab==='overview' ?'re-tab-active':''}" data-tab="overview">Overview</button>
        <button class="re-tab ${_activeTab==='risk'     ?'re-tab-active':''}" data-tab="risk">Risk</button>
        <button class="re-tab ${_activeTab==='simulate' ?'re-tab-active':''}" data-tab="simulate">Simulate</button>
        <button class="re-tab ${_activeTab==='debt'     ?'re-tab-active':''}" data-tab="debt">Debt</button>
        <button class="re-tab ${_activeTab==='advice'   ?'re-tab-active':''}" data-tab="advice">Advice</button>
      </div>
      <div class="re-body" id="re-body"></div>
    `;

    panel.querySelectorAll('.re-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        _activeTab = btn.dataset.tab;
        panel.querySelectorAll('.re-tab').forEach(b =>
          b.classList.toggle('re-tab-active', b.dataset.tab === _activeTab));
        _refreshBody();
      });
    });

    $('re-analyze')?.addEventListener('click', () => _runAnalysis());
    _refreshBody();
  }

  function _refreshBody() {
    const body = $('re-body');
    if (!body) return;

    if (!_workspace) {
      body.innerHTML = `<div class="re-empty"><div class="re-empty-icon">🧠</div><p>Open a workspace to enable<br>Project Reasoning.</p></div>`;
      return;
    }
    if (!_data && !_analyzing) {
      body.innerHTML = `<div class="re-empty"><div class="re-empty-icon">🧠</div><button class="re-cta-btn" id="re-cta">Analyze Project</button><p class="re-empty-hint">Understands risk, debt, and what will break before you change it.</p></div>`;
      $('re-cta')?.addEventListener('click', () => _runAnalysis());
      return;
    }
    if (_analyzing) {
      body.innerHTML = `<div class="re-analyzing"><div class="re-spinner"></div><p>Reasoning about your project…</p></div>`;
      return;
    }

    try {
      switch (_activeTab) {
        case 'overview': body.innerHTML = _buildOverviewTab();  break;
        case 'risk':     body.innerHTML = _buildRiskTab();      break;
        case 'simulate': body.innerHTML = _buildSimulateTab();  break;
        case 'debt':     body.innerHTML = _buildDebtTab();      break;
        case 'advice':   body.innerHTML = _buildAdviceTab();    break;
      }
      _wireBodyEvents();
    } catch (err) {
      body.innerHTML = `<div class="re-error">Render error: ${err.message}</div>`;
    }
  }

  // ── Analysis pipeline — delegates ALL computation to main process ──

  async function _runAnalysis() {
    if (!_workspace || _analyzing) return;
    _analyzing = true;
    _data      = null;
    _refreshBody();

    try {
      const result = await window.noter?.reasoning?.getHealth({ workspaceRoot: _workspace });
      _data = result && !result.error ? result : { error: result?.error || 'Analysis failed' };
    } catch (err) {
      _data = { error: err.message };
    } finally {
      _analyzing = false;
      _refreshBody();
    }
  }

  // ── Tab: Overview ──────────────────────────────────────────────

  function _buildOverviewTab() {
    if (_data?.error) return `<div class="re-error">Analysis failed: ${_data.error}</div>`;
    const h = _data?.health;
    if (!h) return '<div class="re-empty"><p>Run analysis first.</p></div>';

    const score = h.total;
    const col   = score >= 80 ? 'var(--np-success,#4caf7d)' : score >= 60 ? 'var(--np-warn,#d4973a)' : 'var(--np-error,#e05c5c)';
    const label = score >= 80 ? 'Healthy' : score >= 60 ? 'Needs Work' : 'Critical';

    const cats = [
      { name: 'Architecture', score: h.architecture, icon: '🏗' },
      { name: 'Complexity',   score: h.complexity,   icon: '📊' },
      { name: 'Tech Debt',    score: h.debt,         icon: '💳' },
      { name: 'Risk Level',   score: h.risk,         icon: '⚠' },
    ];

    const bars = cats.map(c => {
      const bc = c.score >= 80 ? '#4caf7d' : c.score >= 60 ? '#d4973a' : '#e05c5c';
      return `<div class="re-cat-row">
        <span class="re-cat-icon">${c.icon}</span>
        <span class="re-cat-name">${c.name}</span>
        <div class="re-bar-wrap"><div class="re-bar" style="width:${c.score}%;background:${bc}"></div></div>
        <span class="re-cat-score" style="color:${bc}">${c.score}</span>
      </div>`;
    }).join('');

    return `
      <div class="re-health-block">
        <div class="re-score-circle" style="--scolor:${col}">
          <span class="re-score-num">${score}</span>
          <span class="re-score-lbl">${label}</span>
        </div>
        <p class="re-score-sub">Project Health Score</p>
      </div>
      <div class="re-section">
        <div class="re-section-title">BREAKDOWN</div>
        ${bars}
      </div>
      <div class="re-section">
        <div class="re-section-title">SNAPSHOT</div>
        ${_row('Dead Code',        _data.deadCode?.length ?? 0)}
        ${_row('Cycles',           _data.cycles?.length ?? 0)}
        ${_row('Arch Violations',  _data.archViolations?.length ?? 0)}
        ${_row('Risk Files',       _data.riskItems?.filter(r=>r.level==='critical').length ?? 0)}
      </div>
    `;
  }

  // ── Tab: Risk ──────────────────────────────────────────────────

  function _buildRiskTab() {
    const items = _data?.riskItems || [];
    if (!items.length) return `<div class="re-empty"><p>No files found.<br>Make sure a workspace with code is open.</p></div>`;

    const crit = items.filter(i => i.level === 'critical').length;
    const med  = items.filter(i => i.level === 'medium').length;

    const rows = items.map(item => {
      const dot = item.level === 'critical' ? 're-dot-crit' : item.level === 'medium' ? 're-dot-med' : 're-dot-low';
      return `<div class="re-risk-row">
        <span class="re-dot ${dot}"></span>
        <span class="re-risk-file" title="${item.fullPath}">${item.file}</span>
        <div class="re-risk-meta">
          <span class="re-risk-callers">callers: ${item.callers}</span>
          <span class="re-risk-num">${item.risk}</span>
        </div>
      </div>`;
    }).join('');

    return `
      <div class="re-section">
        <div class="re-section-title">RISK SUMMARY</div>
        ${_row('🔴 Critical', crit)}
        ${_row('🟡 Medium',   med)}
        ${_row('🟢 Low',      items.length - crit - med)}
      </div>
      <div class="re-section">
        <div class="re-section-title">FILES BY RISK (highest first)</div>
        <div class="re-risk-list">${rows}</div>
      </div>
      <div class="re-risk-hint">Risk score = caller density + dependency depth + cycle involvement</div>
    `;
  }

  // ── Tab: Simulate ──────────────────────────────────────────────

  function _buildSimulateTab() {
    const resultHtml = _simResult ? _renderSimResult(_simResult)
      : `<div class="re-sim-placeholder">Enter a file path and click Simulate to see what breaks before you change it.</div>`;

    return `
      <div class="re-section">
        <div class="re-section-title">CHANGE SIMULATOR</div>
        <p class="re-sim-desc">See the blast radius <em>before</em> making a change.</p>
        <div class="re-sim-row">
          <input id="re-sim-input" class="re-sim-input" type="text"
                 value="${_simFile || ''}"
                 placeholder="src/auth/service.ts" spellcheck="false"/>
          <button class="re-sim-run-btn" id="re-sim-run">Simulate</button>
        </div>
      </div>
      <div id="re-sim-result">${resultHtml}</div>
    `;
  }

  function _renderSimResult(r) {
    if (r.error) return `<div class="re-error">${r.error}</div>`;
    const direct = r.directImporters || [];
    const total  = r.impactedFiles   || r.affectedFiles || direct;
    if (!direct.length && !(Array.isArray(total) ? total.length : Object.keys(total).length)) {
      return `<div class="re-sim-safe"><span class="re-sim-safe-icon">✓</span><p>No dependents found.<br><strong>Safe to modify.</strong></p></div>`;
    }
    const files    = Array.isArray(total) ? total : Object.keys(total);
    const severity = files.length > 10 ? 'HIGH' : files.length > 4 ? 'MEDIUM' : 'LOW';
    const sevCol   = severity === 'HIGH' ? '#e05c5c' : severity === 'MEDIUM' ? '#d4973a' : '#4caf7d';
    const preview  = files.slice(0, 8).map(f => `<div class="re-sim-file">${_shortPath(f)}</div>`).join('');
    return `
      <div class="re-sim-impact" style="border-left-color:${sevCol}">
        <div class="re-sim-impact-hd"><span class="re-sim-sev" style="color:${sevCol}">Impact: ${severity}</span></div>
        ${_row('Direct Dependents', direct.length || r.affectedFileCount || '?')}
        ${_row('Total Affected',    files.length)}
      </div>
      ${preview ? `<div class="re-section-title re-sim-files-hd">AFFECTED FILES</div>${preview}` : ''}
    `;
  }

  // ── Tab: Debt ──────────────────────────────────────────────────

  function _buildDebtTab() {
    const dc  = _data?.deadCode       || [];
    const cy  = _data?.cycles         || [];
    const av  = _data?.archViolations || [];
    const lf  = _data?.largeFiles     || [];

    if (!dc.length && !cy.length && !av.length) {
      return `<div class="re-empty"><span style="font-size:22px">✓</span><p>No significant debt detected.</p></div>`;
    }

    const parts = [];
    if (cy.length) {
      const rows = cy.slice(0, 6).map(c => {
        const files = Array.isArray(c.cycle) ? c.cycle : [c.from, c.to].filter(Boolean);
        return `<div class="re-debt-row"><span class="re-badge re-badge-err">cycle</span><span class="re-debt-txt">${files.map(_shortPath).join(' → ')}</span></div>`;
      }).join('');
      parts.push(`<div class="re-section"><div class="re-section-title">CIRCULAR DEPENDENCIES (${cy.length})</div>${rows}${cy.length > 6 ? `<div class="re-debt-more">+${cy.length-6} more</div>` : ''}</div>`);
    }
    if (av.length) {
      const rows = av.slice(0, 5).map(v =>
        `<div class="re-debt-row"><span class="re-badge re-badge-warn">violation</span><span class="re-debt-txt">${_shortPath(v.from || v.file || '')} → ${_shortPath(v.to || v.expected || '')}</span></div>`).join('');
      parts.push(`<div class="re-section"><div class="re-section-title">ARCH VIOLATIONS (${av.length})</div>${rows}${av.length > 5 ? `<div class="re-debt-more">+${av.length-5} more</div>` : ''}</div>`);
    }
    if (dc.length) {
      const rows = dc.slice(0, 8).map(d => {
        const name = d.symbol || d.name || d.export || '';
        const file = d.file   || d.path || '';
        return `<div class="re-debt-row"><span class="re-badge re-badge-info">dead</span><span class="re-debt-txt">${name || _shortPath(file)}${name && file ? ` in ${_shortPath(file)}` : ''}</span></div>`;
      }).join('');
      parts.push(`<div class="re-section"><div class="re-section-title">DEAD CODE (${dc.length})</div>${rows}${dc.length > 8 ? `<div class="re-debt-more">+${dc.length-8} more</div>` : ''}</div>`);
    }
    if (lf.length) {
      const rows = lf.slice(0, 6).map(f =>
        `<div class="re-debt-row"><span class="re-badge re-badge-info">large</span><span class="re-debt-txt">${_shortPath(f.path || f.name || f)}</span></div>`).join('');
      parts.push(`<div class="re-section"><div class="re-section-title">COMPLEX FILES (${lf.length})</div>${rows}</div>`);
    }
    return parts.join('');
  }

  // ── Tab: Advice ────────────────────────────────────────────────

  function _buildAdviceTab() {
    const recs = _data?.recommendations || [];
    if (!recs.length) return `<div class="re-empty"><p>Run analysis to get recommendations.</p></div>`;
    return `<div class="re-section"><div class="re-section-title">RECOMMENDATIONS</div>
      ${recs.map(r => `
        <div class="re-advice re-advice-${r.priority}">
          <div class="re-advice-hd"><span>${r.icon}</span><span class="re-advice-title">${r.title}</span></div>
          <p class="re-advice-detail">${r.detail}</p>
        </div>`).join('')}
    </div>`;
  }

  // ── Body event wiring ──────────────────────────────────────────

  function _wireBodyEvents() {
    const runBtn = $('re-sim-run');
    if (!runBtn) return;

    runBtn.addEventListener('click', async () => {
      const input = $('re-sim-input');
      _simFile = input?.value.trim() || '';
      if (!_simFile || !_workspace) return;

      const resultDiv = $('re-sim-result');
      if (resultDiv) resultDiv.innerHTML = '<div class="re-analyzing"><div class="re-spinner"></div><p>Simulating…</p></div>';

      try {
        const r = await window.noter?.reasoning?.simulateChange({ workspaceRoot: _workspace, filePath: _simFile })
                  || await window.noter?.graph?.impact({ workspaceRoot: _workspace, filePath: _simFile });
        _simResult = r || { error: 'No impact data — build the code graph first.' };
      } catch (e) {
        _simResult = { error: e.message };
      }

      if (resultDiv) resultDiv.innerHTML = _renderSimResult(_simResult);
    });

    $('re-sim-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('re-sim-run')?.click();
    });
  }

  // ── Helpers ────────────────────────────────────────────────────

  function _row(label, value) {
    return `<div class="re-row"><span class="re-label">${label}</span><span class="re-value">${value}</span></div>`;
  }

  function _shortPath(p) {
    const s = String(p || '').replace(/\\/g, '/');
    const parts = s.split('/');
    return parts.length > 3 ? '…/' + parts.slice(-2).join('/') : s;
  }

  // ── Activity bar wiring ────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    $('ab-reasoning')?.addEventListener('click', () => {
      const sidebar = $('sidebar');
      const panel   = $('reasoning-panel');
      const isOpen  = panel?.style.display !== 'none' && !sidebar?.classList.contains('hidden');

      if (isOpen) {
        if (typeof window.toggleSidebar === 'function') window.toggleSidebar(false);
        else sidebar?.classList.add('hidden');
        $('ab-reasoning')?.classList.remove('ab-active');
        hide();
        return;
      }

      ['explorer-content','no-folder-msg','search-panel',
       'project-overview-panel','code-graph-panel','ai-chat-panel','health-panel'].forEach(id => {
        const el = $(id); if (el) el.style.display = 'none';
      });

      if (typeof window.toggleSidebar === 'function') window.toggleSidebar(true);
      else { sidebar?.classList.remove('hidden'); $('resize-handle')?.classList.remove('hidden'); }

      const title = sidebar?.querySelector('.sidebar-title');
      if (title) title.textContent = 'PROJECT REASONING';

      document.querySelectorAll('.ab-btn').forEach(b => b.classList.remove('ab-active'));
      $('ab-reasoning')?.classList.add('ab-active');

      _workspace = window.explorerState?.rootPath || null;
      show();
    });
  });

  return { show, hide, toggle };
})();

window.ReasoningEngine = ReasoningEngine;

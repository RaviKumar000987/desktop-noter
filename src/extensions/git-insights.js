// ─── Git Insights ────────────────────────────────────────────────
// Branch status, commit log, blame, quick-commit — all inside the editor.

(window._exts = window._exts || {})['git-insights'] = (() => {
  'use strict';

  let _ctx;
  let _branch = '';

  async function _detectBranch() {
    if (!_ctx?.getWorkspace()) return;
    try {
      const r = await window.electronAPI?.terminalExec?.('git rev-parse --abbrev-ref HEAD');
      _branch = (r?.stdout || '').trim();
      if (_branch) _ctx.updateStatus('gi-branch', `⎇ ${_branch}`);
    } catch {}
  }

  function _gitCmd(cmd) {
    const ws = _ctx?.getWorkspace();
    const prefix = ws ? `cd "${ws.replace(/\\/g,'/')}" && ` : '';
    _ctx?.runInTerminal(prefix + cmd);
  }

  function _showLog() {
    const fp  = _ctx?.getFilePath();
    const ws  = _ctx?.getWorkspace();
    if (fp) {
      _gitCmd(`git log --oneline --format="%h  %s  [%an, %ar]" -20 "${fp}"`);
    } else if (ws) {
      _gitCmd(`git log --oneline --format="%h  %s  [%an, %ar]" -20`);
    } else {
      _ctx?.toast('Open a workspace folder first', 'info');
    }
  }

  function _showBlame() {
    const fp  = _ctx?.getFilePath();
    if (!fp)  { _ctx?.toast('No file open', 'info'); return; }
    const line = window.editor?.getPosition()?.lineNumber || 1;
    _gitCmd(`git blame -L ${line},${line} "${fp}"`);
  }

  function _showStatus() {
    const ws = _ctx?.getWorkspace();
    if (!ws)  { _ctx?.toast('Open a workspace folder first', 'info'); return; }
    _gitCmd(`git status`);
  }

  function _showDiff() {
    const fp = _ctx?.getFilePath();
    if (fp) _gitCmd(`git diff "${fp}"`);
    else    _gitCmd(`git diff`);
  }

  function _quickCommit() {
    const panelId = 'ext-git-commit-panel';
    document.getElementById(panelId)?.remove();
    const ws = _ctx?.getWorkspace();
    if (!ws) { _ctx?.toast('Open a workspace folder first', 'info'); return; }

    const panel = _ctx.openPanel(panelId, 'Git Insights — Quick Commit', `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="font-size:11.5px;color:#7d8590">Staged changes will be committed. Run <code style="background:#21262d;padding:1px 5px;border-radius:3px">git add .</code> first if needed.</div>
        <input id="gi-msg-input" type="text" placeholder="Commit message…"
          style="background:#21262d;border:1px solid #30363d;color:#e6edf3;padding:8px 10px;border-radius:6px;font-size:13px;outline:none;width:100%">
        <div style="display:flex;gap:8px">
          <button id="gi-stage-btn" style="flex:1;padding:7px;border-radius:6px;border:1px solid #30363d;background:#21262d;color:#e6edf3;font-size:12px;cursor:pointer">
            git add .
          </button>
          <button id="gi-commit-btn" style="flex:1;padding:7px;border-radius:6px;border:none;background:#238636;color:#fff;font-size:12px;font-weight:600;cursor:pointer">
            Commit →
          </button>
        </div>
        <button id="gi-push-btn" style="padding:7px;border-radius:6px;border:1px solid #30363d;background:#21262d;color:#58a6ff;font-size:12px;cursor:pointer">
          git push
        </button>
      </div>
    `, { icon: '⎇' });

    const inp = document.getElementById('gi-msg-input');
    inp.focus();

    document.getElementById('gi-stage-btn').onclick = () => _gitCmd('git add .');
    document.getElementById('gi-push-btn').onclick  = () => { _gitCmd('git push'); panel.remove(); };
    document.getElementById('gi-commit-btn').onclick = () => {
      const msg = inp.value.trim();
      if (!msg) { _ctx.toast('Enter a commit message', 'error'); return; }
      _gitCmd(`git commit -m "${msg.replace(/"/g,"'")}"`);
      panel.remove();
    };
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('gi-commit-btn')?.click();
    });
  }

  function activate(ctx) {
    _ctx = ctx;

    ctx.addToolbarBtn({
      id:    'ext-git-btn',
      icon:  '⎇',
      label: 'Git',
      title: 'Git Insights — log, blame, status',
      run:   _showPanel,
    });

    ctx.addStatus(
      'gi-branch', '⎇ —',
      'Git branch — click to show status', _showStatus, 'left'
    );

    _detectBranch();
    document.addEventListener('tab-language-changed', _detectBranch);
  }

  function _showPanel() {
    const panelId = 'ext-git-panel';
    document.getElementById(panelId)?.remove();
    const panel = _ctx.openPanel(panelId, 'Git Insights', `
      <div style="display:flex;flex-direction:column;gap:6px">
        ${_branch ? `<div style="font-size:12px;color:#7d8590;margin-bottom:4px">Branch: <span style="color:#58a6ff;font-weight:600">${_branch}</span></div>` : ''}
        <button class="dash-action-btn" id="_gi_status">git status</button>
        <button class="dash-action-btn" id="_gi_log">File Log (last 20)</button>
        <button class="dash-action-btn" id="_gi_blame">Blame Current Line</button>
        <button class="dash-action-btn" id="_gi_diff">Show Diff</button>
        <hr style="border-color:#21262d;margin:4px 0">
        <button class="dash-action-btn" id="_gi_commit" style="color:#3fb950">Quick Commit…</button>
      </div>
    `, { icon: '⎇' });

    panel.querySelector('#_gi_status').onclick  = () => { _showStatus();  panel.remove(); };
    panel.querySelector('#_gi_log').onclick     = () => { _showLog();     panel.remove(); };
    panel.querySelector('#_gi_blame').onclick   = () => { _showBlame();   panel.remove(); };
    panel.querySelector('#_gi_diff').onclick    = () => { _showDiff();    panel.remove(); };
    panel.querySelector('#_gi_commit').onclick  = () => { panel.remove(); _quickCommit(); };
  }

  function deactivate() {
    document.getElementById('ext-git-btn')?.remove();
    _ctx?.removeStatus('gi-branch');
    document.removeEventListener('tab-language-changed', _detectBranch);
  }

  function getQuickStart() {
    return {
      icon:     '⎇',
      title:    'Git Insights',
      subtitle: 'Branch info, log, blame, and quick-commit without leaving the editor',
      steps: [
        { title: 'See Current Branch', desc: 'Your branch name appears in the <strong>bottom-left status bar</strong>. Click it to run <kbd>git status</kbd> in the terminal.' },
        { title: 'Open Git Panel', desc: 'Click the <strong>⎇ Git</strong> toolbar button to open the Git panel with status, log, blame, diff, and commit options.' },
        { title: 'Quick Commit', desc: 'In the Git panel click <strong>Quick Commit…</strong> — stage changes, type a message, and commit in seconds.' },
      ],
      shortcuts: [
        { keys: '⎇ toolbar button',    desc: 'Open Git panel'      },
        { keys: 'Status bar ⎇ badge', desc: 'Run git status'       },
      ],
      commands: [
        { name: 'git.status', desc: 'Run git status in terminal'        },
        { name: 'git.log',    desc: 'Show last 20 commits for this file' },
        { name: 'git.blame',  desc: 'Blame the current line'            },
        { name: 'git.diff',   desc: 'Show git diff'                     },
        { name: 'git.commit', desc: 'Open quick commit panel'           },
      ],
      tips: [
        'All git commands run in the integrated terminal — you can see full output there.',
        'Open a workspace folder first for workspace-level commands (log, status).',
      ],
      onStart: _showPanel,
    };
  }

  return {
    id: 'git-insights',
    activate, deactivate, getQuickStart,
    commands: [
      { id: 'git.status', label: 'Git: Show Status',   run: _showStatus },
      { id: 'git.log',    label: 'Git: File Log',       run: _showLog    },
      { id: 'git.blame',  label: 'Git: Blame Line',     run: _showBlame  },
      { id: 'git.diff',   label: 'Git: Show Diff',      run: _showDiff   },
      { id: 'git.commit', label: 'Git: Quick Commit',   run: _quickCommit},
    ],
  };
})();

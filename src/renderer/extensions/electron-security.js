// ─── Electron Security Scanner ───────────────────────────────────
(window._exts = window._exts || {})['electron-security'] = (() => {
  'use strict';
  let _ctx;

  const CHECKS = [
    { id:'nodeIntegration', label:'nodeIntegration enabled', severity:'high',
      pattern:/nodeIntegration\s*:\s*true/,
      fix:'Set nodeIntegration: false and use contextBridge in preload.js instead.' },
    { id:'contextIsolation', label:'contextIsolation disabled', severity:'high',
      pattern:/contextIsolation\s*:\s*false/,
      fix:'Set contextIsolation: true — it is the default since Electron 12.' },
    { id:'webSecurity', label:'webSecurity disabled', severity:'high',
      pattern:/webSecurity\s*:\s*false/,
      fix:'Remove webSecurity: false — it exposes the app to XSS and cross-origin attacks.' },
    { id:'allowInsecure', label:'allowRunningInsecureContent enabled', severity:'high',
      pattern:/allowRunningInsecureContent\s*:\s*true/,
      fix:'Remove this option — it allows mixed HTTP/HTTPS content.' },
    { id:'unsafeEval', label:"enableBlinkFeatures includes 'eval'", severity:'medium',
      pattern:/enableBlinkFeatures.*eval/,
      fix:"Avoid enabling unsafe Blink features, especially those enabling eval." },
    { id:'openExternal', label:'shell.openExternal without input validation', severity:'medium',
      pattern:/shell\.openExternal\s*\([^)]*(?:req|input|param|data|body)/,
      fix:'Always validate and whitelist URLs before passing to shell.openExternal.' },
    { id:'remoteModule', label:'enableRemoteModule enabled', severity:'medium',
      pattern:/enableRemoteModule\s*:\s*true/,
      fix:'The remote module is deprecated and a security risk. Use ipcMain/ipcRenderer instead.' },
    { id:'noCsp', label:'Missing Content-Security-Policy', severity:'low',
      pattern:/^(?![\s\S]*Content-Security-Policy)/,
      fix:"Add a <meta> CSP tag: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
      htmlOnly:true },
    { id:'unsafeInlineScript', label:"unsafe-eval in CSP", severity:'medium',
      pattern:/'unsafe-eval'/,
      fix:"Remove 'unsafe-eval' from your CSP — it enables XSS vulnerabilities." },
  ];

  function _scan() {
    const content = _ctx?.getContent() || '';
    const lang    = _ctx?.getLang()    || '';
    if (!content.trim()) { _ctx?.toast('Open a file to scan', 'info'); return; }

    const issues = CHECKS.filter(c => {
      if (c.htmlOnly && lang !== 'html') return false;
      return c.pattern.test(content);
    });

    const id = 'ext-security-panel';
    document.getElementById(id)?.remove();

    const rows = issues.length
      ? issues.map(c => `
          <div class="sec-issue">
            <div class="sec-sev ${c.severity}"></div>
            <div class="sec-body">
              <div class="sec-title">${c.label}</div>
              <div class="sec-desc">Severity: <strong>${c.severity.toUpperCase()}</strong></div>
              <div class="sec-fix">✔ Fix: ${c.fix}</div>
            </div>
          </div>`)
      .join('')
      : '<div style="color:#3fb950;font-size:13px;padding:8px 0">✅ No security issues found!</div>';

    const panel = _ctx.openPanel(id, `Security Scan — ${issues.length} issue${issues.length!==1?'s':''}`, `
      <div style="font-size:11.5px;color:#7d8590;margin-bottom:10px">
        Scanning: <code style="color:#58a6ff">${_ctx.getFilePath()?.split(/[/\\]/).pop() || 'current file'}</code>
      </div>
      ${rows}
    `, { icon: '🔒' });
  }

  function activate(ctx) {
    _ctx = ctx;
    ctx.addToolbarBtn({ id:'ext-sec-btn', icon:'🔒', label:'Scan',
      title:'Electron Security Scanner', languages:['javascript','typescript','html'], run:_scan });
  }

  function deactivate() { document.getElementById('ext-sec-btn')?.remove(); }

  function getQuickStart() {
    return {
      icon:'🔒', title:'Electron Security Scanner', subtitle:'Detect 9 common Electron security vulnerabilities instantly',
      steps:[
        { title:'Scan Current File', desc:'Click <strong>🔒 Scan</strong> in the toolbar (visible in JS/TS/HTML files). The scanner checks for known dangerous configurations.' },
        { title:'What Gets Checked', desc:'nodeIntegration:true, contextIsolation:false, webSecurity:false, missing CSP, shell.openExternal misuse, remote module, and more.' },
        { title:'Fix Suggestions', desc:'Each finding includes a clear fix — the exact code change needed to resolve the issue.' },
      ],
      shortcuts:[{ keys:'🔒 toolbar button', desc:'Scan current file for security issues' }],
      commands:[{ name:'security.scan', desc:'Scan current file for Electron security issues' }],
      tips:["All checks are based on the official Electron Security Checklist.",'Combine with Electron Toolkit extension for secure boilerplate snippets.'],
      onStart:_scan,
    };
  }
  return { id:'electron-security', activate, deactivate, getQuickStart, commands:[{ id:'security.scan', label:'Security Scanner: Scan File', run:_scan }] };
})();

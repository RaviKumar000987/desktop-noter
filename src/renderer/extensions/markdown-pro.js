// ─── Markdown Pro ────────────────────────────────────────────────
(window._exts = window._exts || {})['markdown-pro'] = (() => {
  'use strict';
  let _ctx, _panel = null, _sub = null;

  function _md(text) {
    return text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/^#{6}\s(.+)$/gm,'<h6>$1</h6>').replace(/^#{5}\s(.+)$/gm,'<h5>$1</h5>')
      .replace(/^#{4}\s(.+)$/gm,'<h4>$1</h4>').replace(/^#{3}\s(.+)$/gm,'<h3>$1</h3>')
      .replace(/^#{2}\s(.+)$/gm,'<h2>$1</h2>').replace(/^#\s(.+)$/gm,'<h1>$1</h1>')
      .replace(/```(\w*)\n([\s\S]*?)```/gm,'<pre><code class="lang-$1">$2</code></pre>')
      .replace(/`([^`]+)`/g,'<code>$1</code>')
      .replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>')
      .replace(/~~(.+?)~~/g,'<del>$1</del>').replace(/==(.+?)==/g,'<mark>$1</mark>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank">$1</a>')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g,'<img alt="$1" src="$2" style="max-width:100%">')
      .replace(/^> (.+)$/gm,'<blockquote>$1</blockquote>')
      .replace(/^[-*]\s\[x\]\s(.+)$/gm,'<li><input type="checkbox" checked disabled> $1</li>')
      .replace(/^[-*]\s\[ \]\s(.+)$/gm,'<li><input type="checkbox" disabled> $1</li>')
      .replace(/^[-*]\s(.+)$/gm,'<li>$1</li>').replace(/(<li>[\s\S]*?<\/li>)/g,'<ul>$1</ul>')
      .replace(/^\d+\.\s(.+)$/gm,'<li>$1</li>')
      .replace(/^\|(.+)\|$/gm,(m,row)=>'<tr>'+row.split('|').map(c=>`<td>${c.trim()}</td>`).join('')+'</tr>')
      .replace(/(<tr>[\s\S]*?<\/tr>)/g,'<table>$1</table>')
      .replace(/^---+$/gm,'<hr>')
      .replace(/\n\n/g,'</p><p>');
  }

  const PREVIEW_CSS = `
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.7;
      color:#e6edf3;background:#0d1117;padding:24px 32px;max-width:800px;margin:0 auto;font-size:15px}
    h1,h2,h3,h4,h5,h6{color:#e6edf3;margin:24px 0 10px;font-weight:700}
    h1{font-size:2em;border-bottom:1px solid #21262d;padding-bottom:8px}
    h2{font-size:1.5em;border-bottom:1px solid #21262d;padding-bottom:6px}
    a{color:#58a6ff} blockquote{border-left:4px solid #30363d;margin:0;padding:4px 16px;color:#8b949e}
    code{background:#21262d;border:1px solid #30363d;border-radius:4px;padding:1px 6px;font-size:13px}
    pre{background:#161b22;border:1px solid #21262d;border-radius:8px;padding:14px;overflow-x:auto}
    pre code{background:none;border:none;padding:0;font-size:13px;color:#c9d1d9}
    table{border-collapse:collapse;width:100%} td,th{border:1px solid #30363d;padding:7px 12px}
    ul,ol{padding-left:24px} li{margin:3px 0} hr{border:none;border-top:1px solid #21262d}
    mark{background:#d2993d44;color:#d2993d;border-radius:3px;padding:1px 4px}
    img{max-width:100%;border-radius:6px} p{margin:8px 0}
  `;

  function _toggle() {
    if (_panel) { _panel.remove(); _panel=null; _sub?.dispose(); _sub=null; return; }
    const lang = _ctx?.getLang();
    if (lang !== 'markdown') { _ctx?.toast('Open a Markdown file to preview','info'); return; }

    _panel = document.createElement('div');
    _panel.id = 'ext-md-panel';
    _panel.className = 'ext-panel';
    _panel.style.cssText = 'position:fixed;top:60px;right:20px;bottom:60px;width:min(48vw,720px);z-index:7800;display:flex;flex-direction:column;';

    _panel.innerHTML = `
      <div class="ext-panel-header">
        <span class="ext-panel-icon">📄</span>
        <span class="ext-panel-title">Markdown Preview</span>
        <div class="ext-panel-hactions">
          <button class="lp-btn" id="_md_copy" title="Copy as HTML">⎘ HTML</button>
        </div>
        <button class="ext-panel-close">×</button>
      </div>
      <iframe id="md-preview-frame" style="flex:1;border:none" sandbox="allow-same-origin"></iframe>
    `;

    _panel.querySelector('.ext-panel-close').onclick = () => { _panel.remove(); _panel=null; _sub?.dispose(); _sub=null; };
    document.body.appendChild(_panel);

    const frame = document.getElementById('md-preview-frame');

    function update() {
      const html = `<!DOCTYPE html><html><head><style>${PREVIEW_CSS}</style></head><body><p>${_md(_ctx?.getContent()||'')}</p></body></html>`;
      frame.srcdoc = html;
    }

    update();
    _sub = window.editor?.onDidChangeModelContent(() => { clearTimeout(_panel._t); _panel._t = setTimeout(update, 300); });

    document.getElementById('_md_copy').onclick = () => {
      const html = `<style>${PREVIEW_CSS}</style>\n<p>${_md(_ctx?.getContent()||'')}</p>`;
      navigator.clipboard.writeText(html).then(() => _ctx.toast('HTML copied to clipboard!','success'));
    };
  }

  function activate(ctx) {
    _ctx = ctx;
    ctx.addToolbarBtn({ id:'ext-md-btn', icon:'👁', label:'Preview', title:'Markdown Pro — live preview (Alt+M)', languages:['markdown'], run:_toggle });
    document.addEventListener('keydown', e => { if (e.altKey && (e.key==='m'||e.key==='M') && _ctx.getLang()==='markdown') { e.preventDefault(); _toggle(); } });
  }

  function deactivate() { _panel?.remove(); _panel=null; _sub?.dispose(); document.getElementById('ext-md-btn')?.remove(); }

  function getQuickStart() {
    return {
      icon:'📄', title:'Markdown Pro', subtitle:'Live preview with GFM, tables, task lists, and HTML export',
      steps:[
        { title:'Open Preview', desc:'Open any <code>.md</code> file. Click <strong>👁 Preview</strong> in the toolbar or press <kbd>Alt+M</kbd>.' },
        { title:'Auto-Refresh', desc:'The preview updates 300ms after you stop typing — see your formatting in real time.' },
        { title:'Copy as HTML', desc:'Click <strong>⎘ HTML</strong> in the preview header to copy the rendered HTML to clipboard for publishing.' },
      ],
      shortcuts:[
        { keys:'Alt+M', desc:'Toggle Markdown preview' },
        { keys:'⎘ HTML button', desc:'Copy rendered HTML to clipboard' },
      ],
      commands:[{ name:'md.preview', desc:'Toggle Markdown live preview' }],
      tips:['Supports GFM: tables, task lists (- [x]), strikethrough (~~), and highlight (==).','Code blocks have language syntax indicators.'],
      onStart:_toggle,
    };
  }
  return { id:'markdown-pro', activate, deactivate, getQuickStart, commands:[{ id:'md.preview', label:'Markdown Pro: Toggle Preview', run:_toggle }] };
})();

// ─── Live Preview ────────────────────────────────────────────────
// Side-by-side HTML preview with auto-refresh as you type.

(window._exts = window._exts || {})['live-preview'] = (() => {
  'use strict';

  let _ctx;
  let _panel = null;
  let _frame = null;
  let _refreshTimer = null;
  let _contentSub = null;
  let _modelSub   = null;
  let _width = '100%';

  function _buildSrcdoc(content, filePath) {
    // Inject <base> so relative CSS/JS/img paths resolve correctly
    let dir = '';
    if (filePath) {
      dir = filePath.replace(/\\/g, '/').replace(/\/[^/]+$/, '/');
    }
    const base = dir ? `<base href="file:///${dir}">` : '';

    if (content.includes('<html') || content.includes('<!doctype')) {
      return content.replace(/<head>/i, `<head>${base}`) ;
    }
    return `<!DOCTYPE html><html><head>${base}<meta charset="UTF-8"></head><body>${content}</body></html>`;
  }

  function _refresh() {
    if (!_frame) return;
    const content  = _ctx?.getContent() || '';
    const filePath = _ctx?.getFilePath() || '';
    _frame.srcdoc = _buildSrcdoc(content, filePath);
  }

  function _schedRefresh() {
    clearTimeout(_refreshTimer);
    _refreshTimer = setTimeout(_refresh, 400);
  }

  function _setWidth(w) {
    _width = w;
    if (_frame) _frame.style.width = w;
    _panel?.querySelectorAll('.lp-btn').forEach(b => b.classList.toggle('active', b.dataset.w === w));
  }

  function _openPreview() {
    if (_panel) { _panel.remove(); _panel = null; _frame = null; return; }

    const lang = _ctx?.getLang();
    if (lang !== 'html' && lang !== 'xml') {
      _ctx?.toast('Live Preview works with HTML files', 'info');
      return;
    }

    _panel = document.createElement('div');
    _panel.id        = 'ext-live-preview-panel';
    _panel.className = 'ext-panel';
    _panel.style.cssText = `
      position:fixed; top:60px; right:20px; bottom:60px;
      width:min(46vw,700px); z-index:7800; display:flex; flex-direction:column;
    `;

    _panel.innerHTML = `
      <div class="ext-panel-header">
        <span class="ext-panel-icon">🌐</span>
        <span class="ext-panel-title">Live Preview</span>
        <div id="lp-toolbar">
          <button class="lp-btn active" data-w="100%" title="Desktop">⬛</button>
          <button class="lp-btn" data-w="768px" title="Tablet">📱</button>
          <button class="lp-btn" data-w="375px" title="Mobile">📲</button>
          <button class="lp-btn" id="lp-external-btn" title="Open in Browser">↗</button>
        </div>
        <button class="ext-panel-close">×</button>
      </div>
      <iframe id="lp-frame" sandbox="allow-scripts allow-same-origin"
        style="flex:1;border:none;background:#fff;width:100%;"></iframe>
    `;

    _panel.querySelector('.ext-panel-close').onclick = () => {
      _panel.remove(); _panel = null; _frame = null;
      _contentSub?.dispose(); _modelSub?.dispose();
    };

    _panel.querySelectorAll('.lp-btn[data-w]').forEach(b => {
      b.onclick = () => _setWidth(b.dataset.w);
    });

    document.getElementById('lp-external-btn')?.addEventListener('click', () => {
      const fp = _ctx?.getFilePath();
      if (fp) window.electronAPI?.openExternal?.(`file:///${fp.replace(/\\/g,'/')}`);
    });

    document.body.appendChild(_panel);
    _frame = document.getElementById('lp-frame');

    _refresh();

    _contentSub = window.editor?.onDidChangeModelContent(_schedRefresh);
    _modelSub   = window.editor?.onDidChangeModel(() => { _contentSub?.dispose(); _schedRefresh();
      _contentSub = window.editor?.onDidChangeModelContent(_schedRefresh); });
  }

  function activate(ctx) {
    _ctx = ctx;
    ctx.addToolbarBtn({
      id:        'ext-lp-btn',
      icon:      '🌐',
      label:     'Preview',
      title:     'Live Preview — HTML side panel (Alt+P)',
      languages: ['html', 'xml'],
      run:       _openPreview,
    });

    document.addEventListener('keydown', _onKey);
  }

  function _onKey(e) {
    if (e.altKey && !e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
      const lang = _ctx?.getLang();
      if (lang === 'html' || lang === 'xml') { e.preventDefault(); _openPreview(); }
    }
  }

  function deactivate() {
    _panel?.remove(); _panel = null; _frame = null;
    _contentSub?.dispose(); _modelSub?.dispose();
    document.getElementById('ext-lp-btn')?.remove();
    document.removeEventListener('keydown', _onKey);
  }

  function getQuickStart() {
    return {
      icon:     '🌐',
      title:    'Live Preview',
      subtitle: 'Instant side-by-side HTML rendering that updates as you type',
      steps: [
        { title: 'Open a HTML File', desc: 'Open or create any <code>.html</code> file in the editor. The Preview button will appear in the toolbar.' },
        { title: 'Click ▶ Preview', desc: 'Click the <strong>🌐 Preview</strong> toolbar button or press <kbd>Alt+P</kbd>. A live panel opens on the right.' },
        { title: 'Auto-Refresh', desc: 'The preview updates automatically as you type — no need to save! CSS and scripts in the same folder load via the base path.' },
      ],
      shortcuts: [
        { keys: 'Alt+P',         desc: 'Toggle Live Preview panel' },
        { keys: '↗ Open button', desc: 'Open in external browser'  },
      ],
      commands: [
        { name: 'live-preview.toggle', desc: 'Toggle the Live Preview side panel' },
      ],
      tips: [
        'Use the ⬛ 📱 📲 breakpoint buttons to simulate different screen widths.',
        'The preview toolbar is only visible when an HTML file is active.',
      ],
      onStart: _openPreview,
    };
  }

  return {
    id: 'live-preview',
    activate, deactivate, getQuickStart,
    commands: [{ id: 'live-preview.toggle', label: 'Live Preview: Toggle Panel', run: _openPreview }],
  };
})();

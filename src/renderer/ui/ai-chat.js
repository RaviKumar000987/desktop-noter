// ═══════════════════════════════════════════════════════════════
//  AI CHAT PANEL — ai-chat.js   (Phase 2.2)
//  Project-aware AI assistant. Context built from workspace graph.
//  Streaming response. Context Inspector. @mention. /commands.
// ═══════════════════════════════════════════════════════════════

const AiChat = (() => {
  const $ = (id) => document.getElementById(id);

  // ── State ──────────────────────────────────────────────────────
  let _tab         = 'chat';        // 'chat' | 'context' | 'history' | 'config'
  let _streaming   = false;
  let _messages    = [];            // { role, content, timestamp }
  let _lastContext = null;          // last AiContext from Rust
  let _apiKey      = '';
  let _model       = 'claude-sonnet-4-6';
  let _streamBuffer = '';

  const MODELS = ['claude-sonnet-4-6', 'claude-opus-4-8', 'claude-haiku-4-5-20251001'];

  // ── Init ───────────────────────────────────────────────────────
  function init() {
    renderPanel();
    wireEvents();
    wireIpcListeners();
  }

  // ── Panel HTML ─────────────────────────────────────────────────
  function renderPanel() {
    const panel = $('ai-chat-panel');
    if (!panel) return;

    panel.innerHTML = `
      <div class="ai-tabs">
        <button class="ai-tab active" data-tab="chat">Chat</button>
        <button class="ai-tab" data-tab="context">Context</button>
        <button class="ai-tab" data-tab="history">History</button>
        <button class="ai-tab" data-tab="config">Config</button>
      </div>

      <div class="ai-tab-body" id="ai-tab-chat">
        <div class="ai-messages" id="ai-messages"></div>
        <div class="ai-input-row">
          <textarea
            id="ai-input"
            class="ai-input"
            placeholder="Ask anything about your project… (@symbol to mention, /command)"
            rows="3"
          ></textarea>
          <button class="ai-send-btn" id="ai-send" title="Send (Ctrl+Enter)">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M1.5 1.5l13 6.5-13 6.5v-5l9-1.5-9-1.5v-5z"/>
            </svg>
          </button>
        </div>
        <div class="ai-commands-row">
          <button class="ai-cmd" data-cmd="/explain">Explain</button>
          <button class="ai-cmd" data-cmd="/generate">Generate</button>
          <button class="ai-cmd" data-cmd="/refactor">Refactor</button>
          <button class="ai-cmd" data-cmd="/analyze">Analyze</button>
          <button class="ai-cmd" data-cmd="/tests">Tests</button>
        </div>
      </div>

      <div class="ai-tab-body hidden" id="ai-tab-context">
        <div class="ai-ctx-empty" id="ai-ctx-empty">
          Send a query first to see what context was sent to AI.
        </div>
        <div class="ai-ctx-content" id="ai-ctx-content" style="display:none">
          <div class="ai-ctx-section" id="ai-ctx-project"></div>
          <div class="ai-ctx-section" id="ai-ctx-symbols"></div>
          <div class="ai-ctx-section" id="ai-ctx-snippets"></div>
          <div class="ai-ctx-meta" id="ai-ctx-meta"></div>
        </div>
      </div>

      <div class="ai-tab-body hidden" id="ai-tab-history">
        <div class="ai-history-empty">Session history appears here.</div>
      </div>

      <div class="ai-tab-body hidden" id="ai-tab-config">
        <div class="ai-config-form">
          <label class="ai-cfg-label">Anthropic API Key</label>
          <input type="password" id="ai-key-input" class="ai-cfg-input"
                 placeholder="sk-ant-..." autocomplete="off"/>
          <button class="ai-cfg-save" id="ai-key-save">Save Key</button>
          <div class="ai-cfg-hint">Key stored in memory only (not written to disk).</div>

          <label class="ai-cfg-label" style="margin-top:12px">Model</label>
          <select id="ai-model-select" class="ai-cfg-input">
            ${MODELS.map(m => `<option value="${m}"${m === _model ? ' selected' : ''}>${m}</option>`).join('')}
          </select>

          <div class="ai-cfg-status" id="ai-cfg-status"></div>
        </div>
      </div>
    `;
  }

  // ── Events ─────────────────────────────────────────────────────
  function wireEvents() {
    document.addEventListener('click', (e) => {
      // Tab switching
      if (e.target.classList.contains('ai-tab')) {
        const tab = e.target.dataset.tab;
        if (tab) switchTab(tab);
        return;
      }
      // Send button
      if (e.target.closest('#ai-send')) { sendQuery(); return; }
      // Command buttons
      if (e.target.classList.contains('ai-cmd')) {
        const cmd = e.target.dataset.cmd;
        const input = $('ai-input');
        if (input && cmd) {
          input.value = cmd + ' ' + (input.value.trimStart().replace(/^\/\w+\s*/, ''));
          input.focus();
        }
        return;
      }
      // Copy code block
      if (e.target.classList.contains('ai-copy-btn')) {
        const code = e.target.closest('.ai-code-block')?.querySelector('code')?.textContent || '';
        navigator.clipboard.writeText(code).catch(() => {});
        e.target.textContent = 'Copied!';
        setTimeout(() => { e.target.textContent = 'Copy'; }, 1500);
        return;
      }
      // Save API key
      if (e.target.id === 'ai-key-save') {
        const key = $('ai-key-input')?.value?.trim();
        if (key) {
          _apiKey = key;
          window.noter?.ai?.setKey({ key });
          showConfigStatus('Key saved ✓', 'green');
        }
        return;
      }
    });

    // Ctrl+Enter to send
    document.addEventListener('keydown', (e) => {
      if (e.target.id === 'ai-input' && e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        sendQuery();
      }
    });

    // Model selector
    document.addEventListener('change', (e) => {
      if (e.target.id === 'ai-model-select') {
        _model = e.target.value;
      }
    });
  }

  function wireIpcListeners() {
    window.noter?.ai?.onToken(({ delta }) => {
      if (!_streaming) return;
      _streamBuffer += delta;
      updateStreamingMessage(_streamBuffer);
    });

    window.noter?.ai?.onDone(({ totalTokens, inputTokens, outputTokens }) => {
      _streaming = false;
      finalizeStreamingMessage(_streamBuffer, { inputTokens, outputTokens });
      _streamBuffer = '';
      setSendState(false);
    });

    window.noter?.ai?.onError(({ message }) => {
      _streaming = false;
      _streamBuffer = '';
      setSendState(false);
      appendMessage('assistant', `**Error:** ${message}`, true);
    });

    window.noter?.ai?.onContextReady((ctx) => {
      _lastContext = ctx;
      renderContextInspector(ctx);
    });
  }

  // ── Send query ─────────────────────────────────────────────────
  async function sendQuery() {
    if (_streaming) {
      window.noter?.ai?.cancel();
      _streaming = false;
      setSendState(false);
      return;
    }

    const input = $('ai-input');
    if (!input) return;
    const query = input.value.trim();
    if (!query) return;

    input.value = '';
    appendMessage('user', query);
    setSendState(true);
    _streaming = true;
    _streamBuffer = '';

    // Get workspace context
    const root       = window.currentFolderPath || '';
    const symbolDb   = root ? root + '/.noter/symbols.db' : '';
    const projectInfo = getProjectInfo();

    try {
      await window.noter?.ai?.query({
        workspaceRoot: root,
        query,
        symbolDbPath:  symbolDb,
        project:       projectInfo,
        model:         _model,
      });
    } catch (err) {
      _streaming = false;
      setSendState(false);
      appendMessage('assistant', `**Error:** ${err.message}`, true);
    }
  }

  // ── Message rendering ──────────────────────────────────────────
  function appendMessage(role, content, isError = false) {
    const msgs = $('ai-messages');
    if (!msgs) return;

    const div = document.createElement('div');
    div.className = `ai-msg ai-msg-${role}${isError ? ' ai-msg-error' : ''}`;

    if (role === 'assistant') {
      div.innerHTML = renderMarkdown(content);
    } else {
      div.textContent = content;
    }

    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;

    _messages.push({ role, content, timestamp: Date.now() });
    return div;
  }

  let _streamingDiv = null;

  function updateStreamingMessage(text) {
    const msgs = $('ai-messages');
    if (!msgs) return;

    if (!_streamingDiv) {
      _streamingDiv = document.createElement('div');
      _streamingDiv.className = 'ai-msg ai-msg-assistant ai-msg-streaming';
      msgs.appendChild(_streamingDiv);
    }

    _streamingDiv.innerHTML = renderMarkdown(text) + '<span class="ai-cursor">▌</span>';
    msgs.scrollTop = msgs.scrollHeight;
  }

  function finalizeStreamingMessage(text, usage) {
    if (_streamingDiv) {
      _streamingDiv.classList.remove('ai-msg-streaming');
      _streamingDiv.innerHTML = renderMarkdown(text);
      if (usage) {
        const meta = document.createElement('div');
        meta.className = 'ai-msg-meta';
        meta.textContent = `${usage.inputTokens || 0} in / ${usage.outputTokens || 0} out tokens`;
        _streamingDiv.appendChild(meta);
      }
      _streamingDiv = null;
    }
    _messages.push({ role: 'assistant', content: text, timestamp: Date.now() });
  }

  // ── Markdown renderer (code blocks + basic formatting) ─────────
  function renderMarkdown(text) {
    // Escape HTML first
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code blocks ```lang\n...\n```
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<div class="ai-code-block"><div class="ai-code-header"><span>${lang || 'code'}</span><button class="ai-copy-btn">Copy</button></div><pre><code class="language-${lang}">${code}</code></pre></div>`;
    });

    // Inline code `...`
    html = html.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');

    // Bold **...**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic *...*
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Headers ### ## #
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm,  '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm,   '<h2>$1</h2>');

    // Bullet lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Newlines → <br>
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  // ── Context Inspector ──────────────────────────────────────────
  function renderContextInspector(ctx) {
    const empty   = $('ai-ctx-empty');
    const content = $('ai-ctx-content');
    if (!empty || !content) return;

    empty.style.display   = 'none';
    content.style.display = 'block';

    // Project summary
    const projEl = $('ai-ctx-project');
    if (projEl) {
      projEl.innerHTML = `
        <div class="ai-ctx-title">Project</div>
        <div class="ai-ctx-tags">
          ${ctx.language ? `<span class="ai-ctx-tag">${ctx.language}</span>` : ''}
          ${ctx.framework ? `<span class="ai-ctx-tag">${ctx.framework}</span>` : ''}
          ${ctx.architecture ? `<span class="ai-ctx-tag">${ctx.architecture}</span>` : ''}
          ${ctx.database ? `<span class="ai-ctx-tag">${ctx.database}</span>` : ''}
          ${ctx.authSystem ? `<span class="ai-ctx-tag">${ctx.authSystem}</span>` : ''}
        </div>
      `;
    }

    // Ranked symbols
    const symsEl = $('ai-ctx-symbols');
    if (symsEl && ctx.rankedSymbols?.length) {
      symsEl.innerHTML = `
        <div class="ai-ctx-title">Symbols (${ctx.rankedSymbols.length})</div>
        ${ctx.rankedSymbols.map(rs => `
          <div class="ai-ctx-sym">
            <span class="ai-ctx-sym-kind ai-kind-${rs.symbol.kind}">${rs.symbol.kind[0]}</span>
            <span class="ai-ctx-sym-name">${rs.symbol.name}</span>
            <span class="ai-ctx-sym-file">${shortenPath(rs.symbol.file)}:${rs.symbol.line}</span>
            <span class="ai-ctx-sym-score">${Math.round(rs.score)}</span>
          </div>
        `).join('')}
      `;
    }

    // File snippets
    const snipEl = $('ai-ctx-snippets');
    if (snipEl && ctx.fileSnippets?.length) {
      snipEl.innerHTML = `
        <div class="ai-ctx-title">Files (${ctx.fileSnippets.length})</div>
        ${ctx.fileSnippets.map(s => `
          <div class="ai-ctx-file">
            <span class="ai-ctx-file-icon">📄</span>
            <span class="ai-ctx-file-name">${shortenPath(s.file)}</span>
            <span class="ai-ctx-file-lines">L${s.startLine}–${s.endLine}</span>
          </div>
        `).join('')}
      `;
    }

    // Build metadata
    const metaEl = $('ai-ctx-meta');
    if (metaEl) {
      metaEl.textContent = `Built in ${ctx.buildTimeMs}ms · ~${ctx.tokenEstimate} tokens`;
    }
  }

  // ── Tab switching ──────────────────────────────────────────────
  function switchTab(tab) {
    _tab = tab;
    document.querySelectorAll('.ai-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.ai-tab-body').forEach(body => {
      body.classList.toggle('hidden', body.id !== `ai-tab-${tab}`);
    });
  }

  // ── Helpers ────────────────────────────────────────────────────
  function setSendState(sending) {
    const btn = $('ai-send');
    if (!btn) return;
    btn.title = sending ? 'Cancel (Ctrl+Enter)' : 'Send (Ctrl+Enter)';
    btn.classList.toggle('ai-send-cancel', sending);
  }

  function getProjectInfo() {
    // Try to get from last project scan result (window.lastProjectScan set by project-overview.js)
    const scan = window.lastProjectScan;
    if (!scan) return { language: '', framework: null, architecture: null, database: null, orm: null, authSystem: null };

    const frameworks = scan.frameworks || [];
    const getFirst = (cat) => frameworks.find(f => f.category === cat)?.name || null;

    return {
      language:     (scan.languages || [])[0] || '',
      framework:    getFirst('UI') || getFirst('Backend') || null,
      architecture: scan.architecture?.pattern || null,
      database:     getFirst('Database') || null,
      orm:          getFirst('ORM') || null,
      authSystem:   getFirst('Auth') || null,
    };
  }

  function shortenPath(p) {
    if (!p) return '';
    const parts = p.replace(/\\/g, '/').split('/');
    return parts.length > 3 ? '…/' + parts.slice(-3).join('/') : p;
  }

  function showConfigStatus(msg, color = 'var(--text-muted)') {
    const el = $('ai-cfg-status');
    if (el) { el.textContent = msg; el.style.color = color; }
  }

  // ── Public API ─────────────────────────────────────────────────
  function show() {
    const panel = $('ai-chat-panel');
    if (panel) panel.style.display = 'flex';
    // Lazy init
    if (!$('ai-messages')) init();
    $('ai-input')?.focus();
  }

  function hide() {
    const panel = $('ai-chat-panel');
    if (panel) panel.style.display = 'none';
  }

  return { show, hide, init };
})();

window.AiChat = AiChat;

/**
 * AI Provider — Phase 2.2
 * Handles Claude API streaming. Runs in Electron main process.
 *
 * Golden rule: Rust = context building (compute), JS = API call (I/O)
 *
 * Supports:
 *   - Claude (Anthropic API) — primary provider
 *   - OpenAI-compatible — future
 *   - Ollama (local) — future
 */

const https = require('https');

// ── Active stream state ───────────────────────────────────────────────────────

let activeRequest = null;
let apiKey = null;

// ── Provider configuration ────────────────────────────────────────────────────

const PROVIDERS = {
  claude: {
    name:    'Claude (Anthropic)',
    host:    'api.anthropic.com',
    path:    '/v1/messages',
    models:  ['claude-sonnet-4-6', 'claude-opus-4-8', 'claude-haiku-4-5-20251001'],
    default: 'claude-sonnet-4-6',
  },
};

// ── API key management ────────────────────────────────────────────────────────

function setApiKey(key) {
  apiKey = key ? key.trim() : null;
}

function getApiKey() {
  // Priority: runtime-set key → env variable
  return apiKey || process.env.ANTHROPIC_API_KEY || null;
}

function hasApiKey() {
  return !!getApiKey();
}

// ── Streaming query ───────────────────────────────────────────────────────────

/**
 * Stream a query to Claude API.
 * Pushes events to renderer via webContents.send():
 *   noter:ai:token   — { delta: string }
 *   noter:ai:done    — { totalTokens: number, inputTokens: number, outputTokens: number }
 *   noter:ai:error   — { message: string }
 *
 * @param {object} prompt  — { system: string, user: string, model: string }
 * @param {Electron.WebContents} webContents
 * @returns {Promise<void>}
 */
async function streamQuery(prompt, webContents) {
  const key = getApiKey();
  if (!key) {
    webContents.send('noter:ai:error', { message: 'No API key set. Go to AI tab → Config to add your Anthropic API key.' });
    return;
  }

  const model = prompt.model || PROVIDERS.claude.default;
  const body  = JSON.stringify({
    model,
    max_tokens: 4096,
    stream: true,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: PROVIDERS.claude.host,
      path:     PROVIDERS.claude.path,
      method:   'POST',
      headers: {
        'x-api-key':         key,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
        'content-length':    Buffer.byteLength(body),
      },
    };

    activeRequest = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        let errBody = '';
        res.on('data', (chunk) => { errBody += chunk; });
        res.on('end', () => {
          let msg = `API error ${res.statusCode}`;
          try {
            const parsed = JSON.parse(errBody);
            msg = parsed.error?.message || msg;
          } catch {}
          webContents.send('noter:ai:error', { message: msg });
          resolve();
        });
        return;
      }

      let buffer = '';
      let inputTokens  = 0;
      let outputTokens = 0;

      res.on('data', (chunk) => {
        buffer += chunk.toString();
        // Process complete SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // keep incomplete last line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);
            handleSseEvent(event, webContents, (it, ot) => {
              inputTokens  = it || inputTokens;
              outputTokens = ot || outputTokens;
            });
          } catch {}
        }
      });

      res.on('end', () => {
        activeRequest = null;
        webContents.send('noter:ai:done', { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens });
        resolve();
      });

      res.on('error', (err) => {
        activeRequest = null;
        webContents.send('noter:ai:error', { message: err.message });
        resolve();
      });
    });

    activeRequest.on('error', (err) => {
      activeRequest = null;
      webContents.send('noter:ai:error', { message: err.message });
      resolve();
    });

    activeRequest.write(body);
    activeRequest.end();
  });
}

/** Parse Anthropic SSE event and push to renderer. */
function handleSseEvent(event, webContents, onUsage) {
  switch (event.type) {
    case 'content_block_delta':
      if (event.delta?.type === 'text_delta' && event.delta.text) {
        webContents.send('noter:ai:token', { delta: event.delta.text });
      }
      break;
    case 'message_delta':
      if (event.usage) {
        onUsage(event.usage.input_tokens, event.usage.output_tokens);
      }
      break;
    case 'message_start':
      if (event.message?.usage) {
        onUsage(event.message.usage.input_tokens, event.message.usage.output_tokens);
      }
      break;
    default:
      break;
  }
}

// ── Cancel active stream ──────────────────────────────────────────────────────

function cancelStream() {
  if (activeRequest) {
    activeRequest.destroy();
    activeRequest = null;
  }
}

// ── Provider list ─────────────────────────────────────────────────────────────

function listProviders() {
  return Object.entries(PROVIDERS).map(([id, p]) => ({
    id,
    name:      p.name,
    models:    p.models,
    default:   p.default,
    hasApiKey: hasApiKey(),
  }));
}

module.exports = { streamQuery, cancelStream, setApiKey, getApiKey, hasApiKey, listProviders };

/**
 * server.js — Express proxy for Theos
 *
 * Supports three providers: Anthropic, OpenAI, Gemini.
 * The browser calls POST /api/chat with { provider, model, messages }.
 * This server routes to the right upstream API, streams the response back.
 */

import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;

const KEYS = {
  anthropic: process.env.ANTHROPIC_API_KEY || '',
  openai:    process.env.OPENAI_API_KEY    || '',
  gemini:    process.env.GEMINI_API_KEY    || '',
};

const GEMINI_ALLOWED_MODELS = new Set([
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-1.0-pro',
]);

const availableProviders = Object.entries(KEYS)
  .filter(([, v]) => v)
  .map(([k]) => k);

if (availableProviders.length === 0) {
  console.error('[theos] No API keys configured. Add at least one to .env');
  process.exit(1);
}

const app = express();
app.use(express.static(STATIC_DIR));
app.use(express.json({ limit: '1mb' }));

// ─── Health check ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mode: 'proxy', providers: availableProviders });
});

// ─── Chat proxy ───────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { provider = 'openai', model, messages, max_tokens = 2048 } = req.body;

  const key = KEYS[provider];
  if (!key) {
    return res.status(400).json({ error: { message: `Proveedor '${provider}' no está configurado en el servidor.` } });
  }

  try {
    let upstream;

    if (provider === 'anthropic') {
      const systemMsg   = messages.find(m => m.role === 'system');
      const chatMessages = messages.filter(m => m.role !== 'system');
      upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key':         key,
          'anthropic-version': '2023-06-01',
          'content-type':      'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens,
          system:   systemMsg?.content,
          messages: chatMessages,
          stream:   true,
        }),
      });

    } else if (provider === 'openai') {
      upstream = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ model, max_tokens, messages, stream: true }),
      });

    } else if (provider === 'gemini') {
      if (typeof model !== 'string' || !GEMINI_ALLOWED_MODELS.has(model)) {
        return res.status(400).json({ error: { message: 'Modelo de Gemini no permitido.' } });
      }
      const geminiModel = model;

      const systemMsg = messages.find(m => m.role === 'system');
      const contents  = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role:  m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

      const geminiBody = {
        contents,
        generationConfig: { maxOutputTokens: max_tokens },
      };
      if (systemMsg) {
        geminiBody.systemInstruction = { parts: [{ text: systemMsg.content }] };
      }

      upstream = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:streamGenerateContent?key=${key}&alt=sse`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody),
        }
      );
    } else {
      return res.status(400).json({ error: { message: `Proveedor desconocido: ${provider}` } });
    }

    if (!upstream.ok) {
      const errBody = await upstream.text();
      return res.status(upstream.status).send(errBody);
    }

    res.setHeader('Content-Type',  upstream.headers.get('content-type') || 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.setHeader('X-Provider',    provider);

    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) { res.end(); return; }
      res.write(value);
    }

  } catch (err) {
    console.error('[theos] Proxy error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: { message: 'Proxy error: ' + err.message } });
    }
  }
});

// ─── Catch-all: return index.html (SPA) ──────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

createServer(app).listen(PORT, () => {
  console.log(`[theos] Running at http://localhost:${PORT}`);
  console.log(`[theos] Providers available: ${availableProviders.join(', ')}`);
});

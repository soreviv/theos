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
import { randomUUID } from 'crypto';
import path from 'path';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;
const MAX_TOKENS = Number.parseInt(process.env.MAX_TOKENS || '2048', 10);
const MAX_MESSAGES = Number.parseInt(process.env.MAX_MESSAGES || '24', 10);
const MAX_MESSAGE_CHARS = Number.parseInt(process.env.MAX_MESSAGE_CHARS || '4000', 10);
const MAX_REPORT_CONTENT_CHARS = Number.parseInt(process.env.MAX_REPORT_CONTENT_CHARS || '6000', 10);
const MAX_REPORT_COMMENT_CHARS = Number.parseInt(process.env.MAX_REPORT_COMMENT_CHARS || '800', 10);
const RATE_LIMIT_WINDOW_MS = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const RATE_LIMIT_MAX = Number.parseInt(process.env.RATE_LIMIT_MAX || '20', 10);
const MAX_STORED_REPORTS = Number.parseInt(process.env.MAX_STORED_REPORTS || '200', 10);

const KEYS = {
  anthropic: process.env.ANTHROPIC_API_KEY || '',
  openai:    process.env.OPENAI_API_KEY    || '',
  gemini:    process.env.GEMINI_API_KEY    || '',
  mistral:   process.env.MISTRAL_API_KEY   || '',
};

const PROVIDERS = {
  openai: {
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  },
  anthropic: {
    models: ['claude-sonnet-4-6', 'claude-opus-4-6'],
  },
  gemini: {
    models: ['gemini-3-flash-preview', 'gemini-2.5-flash'],
  },
  mistral: {
    models: ['mistral-large-latest', 'mistral-small-latest', 'open-mixtral-8x22b'],
  },
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
app.use(express.static(STATIC_DIR, { dotfiles: 'deny' }));
app.use(express.json({ limit: '1mb' }));

const rateLimitStore = new Map();
const reportStore = [];
const REPORT_REASONS = new Set([
  'doctrinal_error',
  'offensive',
  'unsafe_advice',
  'false_citation',
  'other',
]);

function getClientId(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket.remoteAddress
    || 'unknown';
}

function rateLimit(req, res, next) {
  const now = Date.now();
  const clientId = getClientId(req);
  const current = rateLimitStore.get(clientId);

  if (!current || now > current.resetAt) {
    rateLimitStore.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (current.count >= RATE_LIMIT_MAX) {
    res.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
    return res.status(429).json({
      error: { message: 'Has enviado demasiados mensajes en poco tiempo. Espera un momento e intenta de nuevo.' },
    });
  }

  current.count += 1;
  return next();
}

function sanitizeMessages(rawMessages) {
  if (!Array.isArray(rawMessages)) {
    throw new Error('El historial de mensajes no es valido.');
  }

  const messages = rawMessages
    .filter((message) => message && message.role !== 'system')
    .slice(-MAX_MESSAGES)
    .map((message) => {
      if (!['user', 'assistant'].includes(message.role)) {
        throw new Error('El historial contiene un rol no permitido.');
      }
      if (typeof message.content !== 'string') {
        throw new Error('El historial contiene un mensaje sin texto valido.');
      }
      const content = message.content.trim();
      if (!content) {
        throw new Error('El historial contiene un mensaje vacio.');
      }
      if (content.length > MAX_MESSAGE_CHARS) {
        throw new Error(`Cada mensaje debe tener ${MAX_MESSAGE_CHARS} caracteres o menos.`);
      }
      return { role: message.role, content };
    });

  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    throw new Error('La solicitud debe terminar con un mensaje del usuario.');
  }

  return messages;
}

function validateChatRequest(body) {
  const provider = body?.provider || availableProviders[0];
  const providerConfig = PROVIDERS[provider];

  if (!providerConfig) {
    throw new Error(`Proveedor desconocido: ${provider}`);
  }
  if (!KEYS[provider]) {
    throw new Error(`Proveedor '${provider}' no esta configurado en el servidor.`);
  }
  if (!providerConfig.models.includes(body?.model)) {
    throw new Error(`Modelo no permitido para '${provider}'.`);
  }

  return {
    provider,
    model: body.model,
    messages: sanitizeMessages(body.messages),
  };
}

function withSystemMessage(messages) {
  return [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];
}

function sanitizeReport(body) {
  const reason = String(body?.reason || '').trim();
  const comment = String(body?.comment || '').trim();
  const content = String(body?.content || '').trim();
  const provider = String(body?.provider || '').trim();
  const model = String(body?.model || '').trim();

  if (!REPORT_REASONS.has(reason)) {
    throw new Error('Motivo de reporte no valido.');
  }
  if (!content) {
    throw new Error('El reporte debe incluir la respuesta reportada.');
  }
  if (content.length > MAX_REPORT_CONTENT_CHARS) {
    throw new Error(`La respuesta reportada debe tener ${MAX_REPORT_CONTENT_CHARS} caracteres o menos.`);
  }
  if (comment.length > MAX_REPORT_COMMENT_CHARS) {
    throw new Error(`El comentario debe tener ${MAX_REPORT_COMMENT_CHARS} caracteres o menos.`);
  }

  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    reason,
    comment,
    content,
    provider,
    model,
  };
}

// ─── Health check ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mode: 'proxy',
    providers: availableProviders,
    models: Object.fromEntries(
      availableProviders.map((provider) => [provider, PROVIDERS[provider].models])
    ),
  });
});

// ─── AI content reports ───────────────────────────────────────
app.post('/api/reports', rateLimit, (req, res) => {
  let report;
  try {
    report = sanitizeReport(req.body);
  } catch (err) {
    return res.status(400).json({ error: { message: err.message } });
  }

  reportStore.push(report);
  while (reportStore.length > MAX_STORED_REPORTS) {
    reportStore.shift();
  }

  console.warn('[theos] AI content report received', {
    id: report.id,
    reason: report.reason,
    provider: report.provider,
    model: report.model,
    createdAt: report.createdAt,
  });

  return res.status(201).json({ ok: true, id: report.id });
});

// ─── Chat proxy ───────────────────────────────────────────────
app.post('/api/chat', rateLimit, async (req, res) => {
  let chatRequest;
  try {
    chatRequest = validateChatRequest(req.body);
  } catch (err) {
    return res.status(400).json({ error: { message: err.message } });
  }
app.post('/api/chat', async (req, res) => {
  const { provider = 'gemini', model, messages, max_tokens = 2048 } = req.body;

  const { provider, model, messages } = chatRequest;
  const key = KEYS[provider];
  const messagesWithSystem = withSystemMessage(messages);

  try {
    let upstream;

    if (provider === 'anthropic') {
      const systemMsg   = messagesWithSystem.find(m => m.role === 'system');
      const chatMessages = messagesWithSystem.filter(m => m.role !== 'system');
      upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key':         key,
          'anthropic-version': '2023-06-01',
          'content-type':      'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: MAX_TOKENS,
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
        body: JSON.stringify({ model, max_tokens: MAX_TOKENS, messages: messagesWithSystem, stream: true }),
      });

    } else if (provider === 'mistral') {
      upstream = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ model, max_tokens: MAX_TOKENS, messages: messagesWithSystem, stream: true }),
      });

    } else if (provider === 'gemini') {
      const systemMsg = messagesWithSystem.find(m => m.role === 'system');
      const contents  = messagesWithSystem
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
        generationConfig: { maxOutputTokens: MAX_TOKENS },
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
app.get('*', spaLimiter, (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

createServer(app).listen(PORT, () => {
  console.log(`[theos] Running at http://localhost:${PORT}`);
  console.log(`[theos] Providers available: ${availableProviders.join(', ')}`);
});

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
import { SYSTEM_PROMPT } from './system-prompt.js';
import { buildProviderRequest } from './public/shared/providers.js';

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

// Number of reverse proxies in front of the app (Railway, Render, nginx, …).
// Only when set does Express trust X-Forwarded-For; otherwise the client-supplied
// header is ignored so it cannot be spoofed to bypass rate limiting.
const TRUST_PROXY = process.env.TRUST_PROXY || '';

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
    models: ['gemini-2.0-flash', 'gemini-2.5-flash'],
  },
  mistral: {
    models: ['mistral-large-latest', 'mistral-small-latest', 'open-mixtral-8x22b'],
  },
};

const availableProviders = Object.entries(KEYS)
  .filter(([, v]) => v)
  .map(([k]) => k);


const app = express();

// Trust the reverse proxy only when explicitly configured, so req.ip reflects the
// real client and X-Forwarded-For cannot be forged to evade rate limiting.
if (TRUST_PROXY) {
  const numeric = Number.parseInt(TRUST_PROXY, 10);
  app.set('trust proxy', Number.isNaN(numeric) ? TRUST_PROXY : numeric);
}

// Baseline security headers (defense-in-depth; no external dependency needed).
app.use((_req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ')
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

app.use(express.static(STATIC_DIR, { dotfiles: 'deny' }));
app.use(express.json({ limit: '1mb' }));

const rateLimitStore = new Map();
const rateLimitCleanup = setInterval(() => {
  const now = Date.now();
  for (const [clientId, current] of rateLimitStore.entries()) {
    if (now > current.resetAt) {
      rateLimitStore.delete(clientId);
    }
  }
}, 5 * 60 * 1000);
// Do not keep the process alive solely for the cleanup timer (e.g. under tests).
rateLimitCleanup.unref?.();

const reportStore = [];
const REPORT_REASONS = new Set([
  'doctrinal_error',
  'offensive',
  'unsafe_advice',
  'false_citation',
  'other',
]);

function getClientId(req) {
  // req.ip honors the configured `trust proxy` setting: it uses X-Forwarded-For
  // only when a proxy is trusted, otherwise the direct socket address. This
  // prevents clients from spoofing the header to bypass rate limiting.
  return req.ip || req.socket.remoteAddress || 'unknown';
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

function sendError(res, status, message) {
  return res.status(status).json({ error: { message } });
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
    return sendError(res, 400, err.message);
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
    return sendError(res, 400, err.message);
  }

  const { provider, model, messages } = chatRequest;
  const key = KEYS[provider];
  const messagesWithSystem = withSystemMessage(messages);

  try {
    let request;
    try {
      request = buildProviderRequest({
        provider,
        model,
        apiKey: key,
        messages: messagesWithSystem,
        maxTokens: MAX_TOKENS,
      });
    } catch (err) {
      return sendError(res, 400, err.message);
    }

    const upstream = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
    });

    if (!upstream.ok) {
      const errBody = await upstream.text();
      return res.status(upstream.status).send(errBody);
    }

    if (!upstream.body) {
      return res.status(502).json({ error: { message: 'El proveedor no devolvio ningun contenido.' } });
    }

    res.setHeader('Content-Type',  upstream.headers.get('content-type') || 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.setHeader('X-Provider',    provider);

    const reader = upstream.body.getReader();

    // Abort the upstream read if the client disconnects mid-stream.
    res.on('close', () => { reader.cancel().catch(() => {}); });

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } catch (streamErr) {
      console.error('[theos] Stream error:', streamErr.message);
      reader.cancel().catch(() => {});
      if (!res.headersSent) {
        sendError(res, 502, 'Error al recibir la respuesta del proveedor de IA.');
      } else if (!res.writableEnded) {
        // The response is already streaming, so surface the failure as an SSE
        // error event instead of leaving the connection hanging.
        res.write(`event: error\ndata: ${JSON.stringify({ error: { message: 'Error al recibir la respuesta del proveedor de IA.' } })}\n\n`);
        res.end();
      }
    }

  } catch (err) {
    console.error('[theos] Proxy error:', err.message);
    if (!res.headersSent) {
      sendError(res, 502, 'Error al contactar el proveedor de IA. Intenta de nuevo.');
    }
  }
});

// ─── Catch-all: return index.html (SPA) ──────────────────────
app.get('*', rateLimit, (_req, res) => {
  res.sendFile(path.join(STATIC_DIR, 'index.html'));
});

export {
  app,
  PROVIDERS,
  REPORT_REASONS,
  getClientId,
  rateLimit,
  sanitizeMessages,
  validateChatRequest,
  withSystemMessage,
  sanitizeReport,
};

export function startServer(port = PORT) {
  if (availableProviders.length === 0) {
    throw new Error('No API keys configured. Add at least one to .env');
  }
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.once('error', reject);
    server.listen(port, () => {
      server.removeListener('error', reject);
      server.on('error', (err) => console.error('[theos] Server error:', err.message));
      console.log(`[theos] Running at http://localhost:${port}`);
      console.log(`[theos] Providers: ${availableProviders.join(', ')}`);
      resolve(port);
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer().catch((err) => {
    console.error('[theos]', err.message);
    process.exit(1);
  });
}

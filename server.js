/**
 * server.js — Optional Express proxy for Theos
 *
 * WHY: Keeps your Anthropic API key server-side.
 *      The browser calls POST /api/chat; this server forwards
 *      the request to Anthropic and streams the SSE response back.
 *
 * USAGE:
 *   cp .env.example .env   # add your real key
 *   npm install
 *   npm start              # or: npm run dev  (auto-restarts on change)
 *   Open http://localhost:3000
 */

import express from 'express';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT      = process.env.PORT || 3000;
const API_KEY   = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error('[theos] ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.');
  process.exit(1);
}

const app = express();

// Serve static frontend files
app.use(express.static(__dirname));
app.use(express.json({ limit: '1mb' }));

// ─── Health check ─────────────────────────────────────────────
// Frontend calls this on init to detect proxy mode
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mode: 'proxy' });
});

// ─── Chat proxy ───────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify(req.body),
    });

    if (!upstream.ok) {
      const errBody = await upstream.text();
      return res.status(upstream.status).send(errBody);
    }

    // Pipe SSE stream straight through — preserves real-time streaming
    res.setHeader('Content-Type',  upstream.headers.get('content-type') || 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');

    const reader = upstream.body.getReader();
    const pump   = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { res.end(); return; }
        res.write(value);
      }
    };
    await pump();

  } catch (err) {
    console.error('[theos] Proxy error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: { message: 'Proxy error: ' + err.message } });
    }
  }
});

// ─── Catch-all: return index.html (SPA) ──────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

createServer(app).listen(PORT, () => {
  console.log(`[theos] Running at http://localhost:${PORT}`);
  console.log(`[theos] Mode: proxy (API key protected server-side)`);
});

/**
 * HTTP-level tests for the Express app in server.js.
 *
 * These exercise the routes and middleware (health, reports, chat validation,
 * rate limiting, SPA catch-all) without contacting any upstream AI provider —
 * only request paths that return before the outbound fetch are tested.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.GEMINI_API_KEY = 'test-gemini-key';
delete process.env.MISTRAL_API_KEY;
process.env.RATE_LIMIT_MAX = '5';
process.env.RATE_LIMIT_WINDOW_MS = '60000';

const { app } = await import('../server.js');

// Start the app on an ephemeral port for the duration of the test file.
let server;
let baseUrl;

test.before(async () => {
  server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(() => {
  server?.close();
});

let clientCounter = 0;
/** Unique client id per request so misc tests never trip the rate limiter. */
function freshClient() {
  clientCounter += 1;
  return `198.51.100.${clientCounter}`;
}

function post(path, body, clientId = freshClient()) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': clientId },
    body: JSON.stringify(body),
  });
}

// ─── /api/health ──────────────────────────────────────────────
test('GET /api/health reports proxy mode and configured providers', async () => {
  const res = await fetch(`${baseUrl}/api/health`, {
    headers: { 'X-Forwarded-For': freshClient() },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.mode, 'proxy');
  assert.deepEqual(body.providers.sort(), ['anthropic', 'gemini', 'openai']);
  assert.deepEqual(body.models.openai, ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo']);
});

// ─── /api/reports ─────────────────────────────────────────────
test('POST /api/reports stores a valid report and returns 201', async () => {
  const res = await post('/api/reports', {
    reason: 'doctrinal_error',
    content: 'una respuesta cuestionable',
    comment: 'revisar',
    provider: 'openai',
    model: 'gpt-4o',
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.match(body.id, /^[0-9a-f-]{36}$/);
});

test('POST /api/reports rejects an invalid reason with 400', async () => {
  const res = await post('/api/reports', { reason: 'nope', content: 'texto' });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error.message, /Motivo de reporte no valido/);
});

// ─── /api/chat validation (no upstream call) ──────────────────
test('POST /api/chat rejects an unknown provider with 400', async () => {
  const res = await post('/api/chat', {
    provider: 'acme',
    model: 'x',
    messages: [{ role: 'user', content: 'hola' }],
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error.message, /Proveedor desconocido/);
});

test('POST /api/chat rejects a disallowed model with 400', async () => {
  const res = await post('/api/chat', {
    provider: 'openai',
    model: 'gpt-nope',
    messages: [{ role: 'user', content: 'hola' }],
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error.message, /Modelo no permitido/);
});

test('POST /api/chat rejects a history not ending with a user message', async () => {
  const res = await post('/api/chat', {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    messages: [
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: 'respuesta' },
    ],
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error.message, /debe terminar con un mensaje del usuario/);
});

// ─── Rate limiting ────────────────────────────────────────────
test('rate limiting returns 429 once the window max is exceeded', async () => {
  const client = '203.0.113.200';
  const payload = { reason: 'other', content: 'texto' };

  // RATE_LIMIT_MAX = 5 → first five succeed.
  for (let i = 0; i < 5; i++) {
    const res = await post('/api/reports', payload, client);
    assert.equal(res.status, 201, `request ${i + 1} should succeed`);
  }

  const limited = await post('/api/reports', payload, client);
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get('retry-after'), 'Retry-After header should be set');
  const body = await limited.json();
  assert.match(body.error.message, /demasiados mensajes/);
});

// ─── SPA catch-all ────────────────────────────────────────────
test('GET unknown route serves the SPA index.html', async () => {
  const res = await fetch(`${baseUrl}/some/deep/route`, {
    headers: { 'X-Forwarded-For': freshClient() },
  });
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /<!DOCTYPE html>/i);
});

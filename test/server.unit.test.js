/**
 * Unit tests for the pure logic in server.js.
 *
 * These cover the request-validation and sanitisation helpers, which held the
 * bulk of the server's untested business logic. Environment variables are set
 * before importing so the module-level limits are deterministic.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// Configure limits/keys before importing server.js (module reads env at load).
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.GEMINI_API_KEY = 'test-gemini-key';
delete process.env.MISTRAL_API_KEY; // configured provider, but no key on server
process.env.MAX_MESSAGES = '3';
process.env.MAX_MESSAGE_CHARS = '10';
process.env.MAX_REPORT_CONTENT_CHARS = '20';
process.env.MAX_REPORT_COMMENT_CHARS = '8';

const {
  sanitizeMessages,
  validateChatRequest,
  withSystemMessage,
  sanitizeReport,
  getClientId,
  PROVIDERS,
} = await import('../server.js');

import { SYSTEM_PROMPT } from '../system-prompt.js';

// ─── sanitizeMessages ─────────────────────────────────────────
test('sanitizeMessages: throws when input is not an array', () => {
  assert.throws(() => sanitizeMessages(null), /historial de mensajes no es valido/);
  assert.throws(() => sanitizeMessages('nope'), /historial de mensajes no es valido/);
  assert.throws(() => sanitizeMessages({}), /historial de mensajes no es valido/);
});

test('sanitizeMessages: drops system messages and trims content', () => {
  const out = sanitizeMessages([
    { role: 'system', content: 'ignored' },
    { role: 'user', content: '  hola  ' },
  ]);
  assert.deepEqual(out, [{ role: 'user', content: 'hola' }]);
});

test('sanitizeMessages: keeps only the last MAX_MESSAGES entries', () => {
  const out = sanitizeMessages([
    { role: 'user', content: 'a' },
    { role: 'assistant', content: 'b' },
    { role: 'user', content: 'c' },
    { role: 'assistant', content: 'd' },
    { role: 'user', content: 'e' },
  ]);
  // MAX_MESSAGES = 3 → last three, and must end with a user message.
  assert.deepEqual(out, [
    { role: 'user', content: 'c' },
    { role: 'assistant', content: 'd' },
    { role: 'user', content: 'e' },
  ]);
});

test('sanitizeMessages: rejects disallowed roles', () => {
  assert.throws(
    () => sanitizeMessages([{ role: 'tool', content: 'x' }]),
    /rol no permitido/,
  );
});

test('sanitizeMessages: rejects non-string content', () => {
  assert.throws(
    () => sanitizeMessages([{ role: 'user', content: 42 }]),
    /sin texto valido/,
  );
});

test('sanitizeMessages: rejects empty / whitespace-only content', () => {
  assert.throws(
    () => sanitizeMessages([{ role: 'user', content: '   ' }]),
    /mensaje vacio/,
  );
});

test('sanitizeMessages: rejects content longer than MAX_MESSAGE_CHARS', () => {
  assert.throws(
    () => sanitizeMessages([{ role: 'user', content: 'x'.repeat(11) }]),
    /10 caracteres o menos/,
  );
});

test('sanitizeMessages: requires the final message to be from the user', () => {
  assert.throws(
    () => sanitizeMessages([
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: 'respuesta' },
    ]),
    /debe terminar con un mensaje del usuario/,
  );
});

test('sanitizeMessages: throws when nothing remains after filtering', () => {
  assert.throws(
    () => sanitizeMessages([{ role: 'system', content: 'only system' }]),
    /debe terminar con un mensaje del usuario/,
  );
});

// ─── validateChatRequest ──────────────────────────────────────
test('validateChatRequest: defaults to the first available provider', () => {
  const out = validateChatRequest({
    model: 'claude-sonnet-4-6',
    messages: [{ role: 'user', content: 'hola' }],
  });
  assert.equal(out.provider, 'anthropic');
  assert.equal(out.model, 'claude-sonnet-4-6');
  assert.deepEqual(out.messages, [{ role: 'user', content: 'hola' }]);
});

test('validateChatRequest: rejects unknown providers', () => {
  assert.throws(
    () => validateChatRequest({ provider: 'acme', model: 'x', messages: [] }),
    /Proveedor desconocido: acme/,
  );
});

test('validateChatRequest: rejects providers without a configured key', () => {
  // mistral is a known provider but has no server-side key in this test env.
  assert.throws(
    () => validateChatRequest({
      provider: 'mistral',
      model: 'mistral-large-latest',
      messages: [{ role: 'user', content: 'hola' }],
    }),
    /no esta configurado en el servidor/,
  );
});

test('validateChatRequest: rejects models not allowed for the provider', () => {
  assert.throws(
    () => validateChatRequest({
      provider: 'openai',
      model: 'gpt-does-not-exist',
      messages: [{ role: 'user', content: 'hola' }],
    }),
    /Modelo no permitido/,
  );
});

test('validateChatRequest: returns a sanitised request for valid input', () => {
  const out = validateChatRequest({
    provider: 'openai',
    model: 'gpt-4o',
    messages: [{ role: 'user', content: '  hola  ' }],
  });
  assert.deepEqual(out, {
    provider: 'openai',
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'hola' }],
  });
});

// ─── withSystemMessage ────────────────────────────────────────
test('withSystemMessage: prepends the system prompt', () => {
  const messages = [{ role: 'user', content: 'hola' }];
  const out = withSystemMessage(messages);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { role: 'system', content: SYSTEM_PROMPT });
  assert.deepEqual(out[1], messages[0]);
});

test('withSystemMessage: does not mutate the original array', () => {
  const messages = [{ role: 'user', content: 'hola' }];
  withSystemMessage(messages);
  assert.equal(messages.length, 1);
});

// ─── sanitizeReport ───────────────────────────────────────────
test('sanitizeReport: rejects invalid reasons', () => {
  assert.throws(
    () => sanitizeReport({ reason: 'spam', content: 'texto' }),
    /Motivo de reporte no valido/,
  );
});

test('sanitizeReport: requires reported content', () => {
  assert.throws(
    () => sanitizeReport({ reason: 'offensive', content: '   ' }),
    /debe incluir la respuesta reportada/,
  );
});

test('sanitizeReport: rejects content over the limit', () => {
  assert.throws(
    () => sanitizeReport({ reason: 'offensive', content: 'x'.repeat(21) }),
    /20 caracteres o menos/,
  );
});

test('sanitizeReport: rejects comments over the limit', () => {
  assert.throws(
    () => sanitizeReport({
      reason: 'offensive',
      content: 'contenido',
      comment: 'x'.repeat(9),
    }),
    /8 caracteres o menos/,
  );
});

test('sanitizeReport: normalises a valid report', () => {
  const out = sanitizeReport({
    reason: 'doctrinal_error',
    comment: '  hmm  ',
    content: '  respuesta  ',
    provider: '  openai  ',
    model: '  gpt-4o  ',
  });
  assert.equal(out.reason, 'doctrinal_error');
  assert.equal(out.comment, 'hmm');
  assert.equal(out.content, 'respuesta');
  assert.equal(out.provider, 'openai');
  assert.equal(out.model, 'gpt-4o');
  assert.match(out.id, /^[0-9a-f-]{36}$/);
  assert.equal(out.createdAt, new Date(out.createdAt).toISOString());
});

test('sanitizeReport: accepts every allowed reason', () => {
  for (const reason of ['doctrinal_error', 'offensive', 'unsafe_advice', 'false_citation', 'other']) {
    const out = sanitizeReport({ reason, content: 'ok' });
    assert.equal(out.reason, reason);
  }
});

// ─── getClientId ──────────────────────────────────────────────
test('getClientId: prefers the first X-Forwarded-For entry', () => {
  const req = {
    headers: { 'x-forwarded-for': ' 203.0.113.9 , 10.0.0.1 ' },
    socket: { remoteAddress: '127.0.0.1' },
  };
  assert.equal(getClientId(req), '203.0.113.9');
});

test('getClientId: falls back to the socket remote address', () => {
  const req = { headers: {}, socket: { remoteAddress: '192.0.2.5' } };
  assert.equal(getClientId(req), '192.0.2.5');
});

test('getClientId: falls back to "unknown"', () => {
  const req = { headers: {}, socket: {} };
  assert.equal(getClientId(req), 'unknown');
});

// ─── PROVIDERS config sanity ──────────────────────────────────
test('PROVIDERS: every provider exposes a non-empty model list', () => {
  for (const [name, cfg] of Object.entries(PROVIDERS)) {
    assert.ok(Array.isArray(cfg.models), `${name} should have a models array`);
    assert.ok(cfg.models.length > 0, `${name} should list at least one model`);
  }
});

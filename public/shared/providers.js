/**
 * providers.js — Shared provider utilities for Theos
 *
 * Runs in both Node (server proxy) and the browser (direct mode). Keep it free
 * of environment-specific APIs: only `fetch`, `Response`, and `JSON` are used.
 *
 * Responsibilities:
 *  - Normalising the message list (splitting out the system message).
 *  - Building the upstream request (URL, headers, body) for each provider.
 *  - Parsing a single SSE event into a text delta.
 *  - Extracting a human-readable error message from a failed response.
 */

export const OPENAI_COMPATIBLE_PROVIDERS = new Set(['openai', 'mistral']);

const OPENAI_COMPATIBLE_ENDPOINTS = {
  openai:  'https://api.openai.com/v1/chat/completions',
  mistral: 'https://api.mistral.ai/v1/chat/completions',
};

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

/** Splits a message list into its system message and the remaining chat turns. */
export function splitSystemMessages(messages) {
  return {
    system: messages.find((m) => m.role === 'system') || null,
    chat: messages.filter((m) => m.role !== 'system'),
  };
}

/** Maps chat turns to Gemini's `contents` shape. */
export function toGeminiContents(chat) {
  return chat.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

/**
 * Builds the upstream request for a provider.
 *
 * @param {object} args
 * @param {string} args.provider
 * @param {string} args.model
 * @param {string} args.apiKey
 * @param {Array}  args.messages  Full message list, may include a system message.
 * @param {number} args.maxTokens
 * @param {boolean} [args.directBrowser]  Adds Anthropic's browser-access header.
 * @returns {{ url: string, headers: object, body: object }}
 */
export function buildProviderRequest({ provider, model, apiKey, messages, maxTokens, directBrowser = false }) {
  if (OPENAI_COMPATIBLE_PROVIDERS.has(provider)) {
    return {
      url: OPENAI_COMPATIBLE_ENDPOINTS[provider],
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: { model, max_tokens: maxTokens, messages, stream: true },
    };
  }

  if (provider === 'anthropic') {
    const { system, chat } = splitSystemMessages(messages);
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    };
    if (directBrowser) {
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }
    return {
      url: ANTHROPIC_ENDPOINT,
      headers,
      body: { model, max_tokens: maxTokens, system: system?.content, messages: chat, stream: true },
    };
  }

  if (provider === 'gemini') {
    const { system, chat } = splitSystemMessages(messages);
    const body = {
      contents: toGeminiContents(chat),
      generationConfig: { maxOutputTokens: maxTokens },
    };
    if (system) {
      body.systemInstruction = { parts: [{ text: system.content }] };
    }
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?key=${apiKey}&alt=sse`,
      headers: { 'Content-Type': 'application/json' },
      body,
    };
  }

  throw new Error(`Proveedor desconocido: ${provider}`);
}

/** Extracts the text delta from a single parsed SSE event for a provider. */
export function extractSSEDelta(provider, event) {
  if (provider === 'anthropic') {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      return event.delta.text;
    }
    return null;
  }
  if (OPENAI_COMPATIBLE_PROVIDERS.has(provider)) {
    return event.choices?.[0]?.delta?.content ?? null;
  }
  if (provider === 'gemini') {
    return event.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  }
  return null;
}

/**
 * Reads a human-readable error message from a failed `fetch` Response,
 * falling back to a status-based message.
 */
export async function extractErrorMessage(res, fallback = `Error de API: ${res.status}`) {
  try {
    const data = await res.json();
    if (data?.error?.message) return data.error.message;
  } catch { /* ignore malformed error bodies */ }
  return fallback;
}

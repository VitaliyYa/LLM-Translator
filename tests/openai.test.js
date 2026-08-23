import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENAI_ENDPOINT,
  MAX_INPUT_LENGTH,
  REQUEST_TIMEOUT_MS,
  normalizeEndpointUrl,
  buildOpenAIRequestBody,
  cleanTranslationOutput,
  parseOpenAIResponse,
  normalizeOpenAIError,
  translateWithOpenAI
} from '../openai.js';

test('OpenAI constants are correctly defined', () => {
  assert.equal(DEFAULT_OPENAI_MODEL, 'meta-llama/llama-3.3-70b-instruct:free');
  assert.equal(DEFAULT_OPENAI_ENDPOINT, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(MAX_INPUT_LENGTH, 10000);
  assert.equal(REQUEST_TIMEOUT_MS, 30000);
});

test('normalizeEndpointUrl normalizes various URL patterns', () => {
  assert.equal(
    normalizeEndpointUrl('https://openrouter.ai/api/v1/chat/completions'),
    'https://openrouter.ai/api/v1/chat/completions'
  );

  assert.equal(
    normalizeEndpointUrl('https://openrouter.ai/api/v1/chat/completions/'),
    'https://openrouter.ai/api/v1/chat/completions'
  );

  assert.equal(
    normalizeEndpointUrl('https://openrouter.ai/api/v1'),
    'https://openrouter.ai/api/v1/chat/completions'
  );

  assert.equal(
    normalizeEndpointUrl('https://openrouter.ai/api/v1/'),
    'https://openrouter.ai/api/v1/chat/completions'
  );

  assert.equal(
    normalizeEndpointUrl('http://localhost:11434/v1'),
    'http://localhost:11434/v1/chat/completions'
  );

  assert.equal(
    normalizeEndpointUrl('http://localhost:11434'),
    'http://localhost:11434/v1/chat/completions'
  );

  assert.equal(
    normalizeEndpointUrl('openrouter.ai/api/v1'),
    'https://openrouter.ai/api/v1/chat/completions'
  );

  assert.throws(
    () => normalizeEndpointUrl(''),
    (err) => err.code === 'SETTINGS_MISSING'
  );

  assert.throws(
    () => normalizeEndpointUrl('   '),
    (err) => err.code === 'SETTINGS_MISSING'
  );
});

test('buildOpenAIRequestBody creates correct payload schema', () => {
  const text = 'Hello world, how are you?';
  const targetLanguage = 'Spanish';
  const model = 'custom/model-name';
  const body = buildOpenAIRequestBody(text, targetLanguage, model);

  assert.equal(body.model, 'custom/model-name');
  assert.equal(body.temperature, 0.3);
  assert.equal(body.messages.length, 2);

  assert.equal(body.messages[0].role, 'system');
  assert.ok(body.messages[0].content.includes('Spanish'));
  assert.ok(body.messages[0].content.includes('Strict Rules:'));

  assert.equal(body.messages[1].role, 'user');
  assert.equal(body.messages[1].content, text);
});

test('cleanTranslationOutput strips markdown code block wrappers and trims', () => {
  assert.equal(cleanTranslationOutput('   Hola mundo   '), 'Hola mundo');
  assert.equal(cleanTranslationOutput('```\nHola mundo\n```'), 'Hola mundo');
  assert.equal(cleanTranslationOutput('```text\nHola mundo\n```'), 'Hola mundo');
  assert.equal(cleanTranslationOutput('```json\nHola mundo\n```'), 'Hola mundo');
  assert.equal(cleanTranslationOutput(null), '');
});

test('parseOpenAIResponse extracts translation from standard chat completion', () => {
  const payload = {
    choices: [
      {
        message: {
          role: 'assistant',
          content: 'Hola mundo'
        },
        finish_reason: 'stop'
      }
    ]
  };

  assert.equal(parseOpenAIResponse(payload), 'Hola mundo');
});

test('parseOpenAIResponse handles direct translation field', () => {
  const payload = { translation: 'Direct translation text' };
  assert.equal(parseOpenAIResponse(payload), 'Direct translation text');
});

test('parseOpenAIResponse throws on refusal and content_filter', () => {
  const refusalPayload = {
    choices: [
      {
        message: {
          role: 'assistant',
          refusal: 'I cannot translate this text.'
        }
      }
    ]
  };

  assert.throws(
    () => parseOpenAIResponse(refusalPayload),
    (err) => err.code === 'BLOCKED' && err.message.includes('refused by model')
  );

  const filterPayload = {
    choices: [
      {
        message: {
          role: 'assistant',
          content: ''
        },
        finish_reason: 'content_filter'
      }
    ]
  };

  assert.throws(
    () => parseOpenAIResponse(filterPayload),
    (err) => err.code === 'BLOCKED' && err.message.includes('content filter')
  );
});

test('parseOpenAIResponse throws BAD_RESPONSE for length termination or error objects', () => {
  const lengthPayload = {
    choices: [
      {
        message: {
          role: 'assistant',
          content: 'Partial translation...'
        },
        finish_reason: 'length'
      }
    ]
  };

  assert.throws(
    () => parseOpenAIResponse(lengthPayload),
    (err) => err.code === 'BAD_RESPONSE' && err.message.includes('maximum response tokens')
  );

  const errorPayload = {
    error: {
      message: 'Invalid model name'
    }
  };

  assert.throws(
    () => parseOpenAIResponse(errorPayload),
    (err) => err.code === 'BAD_RESPONSE' && err.message.includes('Invalid model name')
  );
});

test('parseOpenAIResponse throws BAD_RESPONSE for malformed or empty payloads', () => {
  assert.throws(
    () => parseOpenAIResponse(null),
    (err) => err.code === 'BAD_RESPONSE'
  );

  assert.throws(
    () => parseOpenAIResponse({ choices: [] }),
    (err) => err.code === 'BAD_RESPONSE'
  );

  assert.throws(
    () => parseOpenAIResponse({ choices: [{ message: { content: '   ' } }] }),
    (err) => err.code === 'BAD_RESPONSE'
  );
});

test('normalizeOpenAIError handles pre-coded errors and HTTP statuses', () => {
  const existing = { code: 'SETTINGS_MISSING', message: 'Settings required' };
  assert.deepEqual(normalizeOpenAIError(existing), {
    code: 'SETTINGS_MISSING',
    message: 'Settings required'
  });

  assert.equal(normalizeOpenAIError(new Error(), 401).code, 'AUTH');
  assert.equal(normalizeOpenAIError(new Error(), 403).code, 'AUTH');
  assert.equal(normalizeOpenAIError(new Error(), 404).code, 'BAD_RESPONSE');
  assert.equal(normalizeOpenAIError(new Error(), 429).code, 'RATE_LIMIT');
  assert.equal(normalizeOpenAIError(new Error(), 500).code, 'BAD_RESPONSE');
  assert.equal(normalizeOpenAIError(new Error(), 502).code, 'BAD_RESPONSE');
});

test('normalizeOpenAIError handles error names and message patterns', () => {
  const abortErr = new Error('The operation was aborted');
  abortErr.name = 'AbortError';
  assert.equal(normalizeOpenAIError(abortErr).code, 'TIMEOUT');

  const timeoutErr = new Error('request timed out');
  assert.equal(normalizeOpenAIError(timeoutErr).code, 'TIMEOUT');

  const networkErr = new TypeError('Failed to fetch');
  assert.equal(normalizeOpenAIError(networkErr).code, 'NETWORK');

  const filterErr = new Error('content filtered by safety');
  assert.equal(normalizeOpenAIError(filterErr).code, 'BLOCKED');

  const authErr = new Error('Invalid API key provided');
  assert.equal(normalizeOpenAIError(authErr).code, 'AUTH');
});

test('translateWithOpenAI validates input length and target language', async () => {
  await assert.rejects(
    () => translateWithOpenAI({ endpoint: 'https://openrouter.ai/api/v1', targetLanguage: '', text: 'Hello' }),
    (err) => err.code === 'SETTINGS_MISSING'
  );

  const longText = 'a'.repeat(MAX_INPUT_LENGTH + 1);
  await assert.rejects(
    () => translateWithOpenAI({ endpoint: 'https://openrouter.ai/api/v1', targetLanguage: 'Spanish', text: longText }),
    (err) => err.code === 'TEXT_TOO_LONG'
  );
});

test('translateWithOpenAI performs successful translation with mocked fetch', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
      assert.equal(options.headers['Authorization'], 'Bearer sk-or-test-key');
      assert.equal(options.headers['Content-Type'], 'application/json');

      const body = JSON.parse(options.body);
      assert.equal(body.model, 'meta-llama/llama-3.3-70b-instruct:free');
      assert.equal(body.messages[1].content, 'Hello world');

      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Hola mundo'
              },
              finish_reason: 'stop'
            }
          ]
        })
      };
    };

    const translation = await translateWithOpenAI({
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: 'sk-or-test-key',
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      targetLanguage: 'Spanish',
      text: 'Hello world'
    });

    assert.equal(translation, 'Hola mundo');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('translateWithOpenAI propagates HTTP error status and cancellation', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API Key' } })
    });

    await assert.rejects(
      () => translateWithOpenAI({
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: 'bad-key',
        targetLanguage: 'Spanish',
        text: 'Hello'
      }),
      (err) => err.code === 'AUTH'
    );

    const controller = new AbortController();
    controller.abort();

    await assert.rejects(
      () => translateWithOpenAI({
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: 'good-key',
        targetLanguage: 'Spanish',
        text: 'Hello',
        signal: controller.signal
      }),
      (err) => err.code === 'TIMEOUT' || err.name === 'AbortError'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

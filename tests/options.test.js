import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateSettings,
  showStatusMessage,
  hideStatusMessage
} from '../options.js';

test('validateSettings succeeds for valid options payload', () => {
  const result = validateSettings({
    provider: 'gemini',
    targetLanguage: 'Russian',
    model: 'gemini-3.5-flash-lite',
    apiKey: 'AIzaSyTestApiKey123'
  });

  assert.equal(result.valid, true);
  assert.equal(result.data.provider, 'gemini');
  assert.equal(result.data.targetLanguage, 'Russian');
  assert.equal(result.data.model, 'gemini-3.5-flash-lite');
  assert.equal(result.data.apiKey, 'AIzaSyTestApiKey123');
});

test('validateSettings trims input values', () => {
  const result = validateSettings({
    provider: 'gemini',
    targetLanguage: '  Spanish  ',
    model: '  gemini-1.5-pro  ',
    apiKey: '  AIzaSyTrimmedKey  '
  });

  assert.equal(result.valid, true);
  assert.equal(result.data.targetLanguage, 'Spanish');
  assert.equal(result.data.model, 'gemini-1.5-pro');
  assert.equal(result.data.apiKey, 'AIzaSyTrimmedKey');
});

test('validateSettings succeeds for valid OpenAI-compatible settings', () => {
  const result = validateSettings({
    provider: 'openai_compatible',
    targetLanguage: 'German',
    customEndpoint: 'https://openrouter.ai/api/v1/chat/completions',
    customModel: 'meta-llama/llama-3.3-70b-instruct:free',
    customApiKey: 'sk-or-v1-testkey'
  });

  assert.equal(result.valid, true);
  assert.equal(result.data.provider, 'openai_compatible');
  assert.equal(result.data.targetLanguage, 'German');
  assert.equal(result.data.customEndpoint, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(result.data.customModel, 'meta-llama/llama-3.3-70b-instruct:free');
  assert.equal(result.data.customApiKey, 'sk-or-v1-testkey');
});

test('validateSettings fails when targetLanguage is empty or missing', () => {
  const missing = validateSettings({
    targetLanguage: '',
    model: 'gemini-3.5-flash-lite',
    apiKey: 'AIzaSyKey'
  });

  assert.equal(missing.valid, false);
  assert.equal(missing.field, 'targetLanguage');
  assert.match(missing.error, /target language/i);

  const undefinedLang = validateSettings({
    model: 'gemini-3.5-flash-lite',
    apiKey: 'AIzaSyKey'
  });

  assert.equal(undefinedLang.valid, false);
  assert.equal(undefinedLang.field, 'targetLanguage');
});

test('validateSettings fails when model is empty or contains invalid characters for Gemini', () => {
  const emptyModel = validateSettings({
    provider: 'gemini',
    targetLanguage: 'German',
    model: '',
    apiKey: 'AIzaSyKey'
  });

  assert.equal(emptyModel.valid, false);
  assert.equal(emptyModel.field, 'model');

  const invalidModelChars = validateSettings({
    provider: 'gemini',
    targetLanguage: 'German',
    model: 'gemini@#$$%',
    apiKey: 'AIzaSyKey'
  });

  assert.equal(invalidModelChars.valid, false);
  assert.equal(invalidModelChars.field, 'model');
  assert.match(invalidModelChars.error, /invalid gemini model/i);

  const spacesInModel = validateSettings({
    provider: 'gemini',
    targetLanguage: 'German',
    model: 'gemini 1.5 flash',
    apiKey: 'AIzaSyKey'
  });

  assert.equal(spacesInModel.valid, false);
  assert.equal(spacesInModel.field, 'model');
});

test('validateSettings fails when apiKey is empty or missing for Gemini', () => {
  const emptyKey = validateSettings({
    provider: 'gemini',
    targetLanguage: 'French',
    model: 'gemini-3.5-flash-lite',
    apiKey: ''
  });

  assert.equal(emptyKey.valid, false);
  assert.equal(emptyKey.field, 'apiKey');
  assert.match(emptyKey.error, /api key/i);

  const undefinedKey = validateSettings({
    provider: 'gemini',
    targetLanguage: 'French',
    model: 'gemini-3.5-flash-lite'
  });

  assert.equal(undefinedKey.valid, false);
  assert.equal(undefinedKey.field, 'apiKey');
});

test('validateSettings fails when customEndpoint or customModel is invalid for OpenAI-compatible', () => {
  const missingEndpoint = validateSettings({
    provider: 'openai_compatible',
    targetLanguage: 'French',
    customEndpoint: '',
    customModel: 'meta-llama/llama-3.3-70b-instruct:free'
  });

  assert.equal(missingEndpoint.valid, false);
  assert.equal(missingEndpoint.field, 'customEndpoint');

  const missingModel = validateSettings({
    provider: 'openai_compatible',
    targetLanguage: 'French',
    customEndpoint: 'https://openrouter.ai/api/v1',
    customModel: ''
  });

  assert.equal(missingModel.valid, false);
  assert.equal(missingModel.field, 'customModel');
});

test('showStatusMessage and hideStatusMessage update element properties', () => {
  const mockEl = { textContent: '', className: '' };

  showStatusMessage(mockEl, 'Test message', 'success');
  assert.equal(mockEl.textContent, 'Test message');
  assert.equal(mockEl.className, 'status-message visible success');

  showStatusMessage(mockEl, 'Error occurred', 'error');
  assert.equal(mockEl.textContent, 'Error occurred');
  assert.equal(mockEl.className, 'status-message visible error');

  hideStatusMessage(mockEl);
  assert.equal(mockEl.textContent, '');
  assert.equal(mockEl.className, 'status-message');

  // Should gracefully handle null/undefined element
  assert.doesNotThrow(() => showStatusMessage(null, 'No crash'));
  assert.doesNotThrow(() => hideStatusMessage(null));
});

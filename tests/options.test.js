import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateSettings,
  showStatusMessage,
  hideStatusMessage
} from '../options.js';

test('validateSettings succeeds for valid options payload', () => {
  const result = validateSettings({
    targetLanguage: 'Russian',
    model: 'gemini-3.5-flash-lite',
    apiKey: 'AIzaSyTestApiKey123'
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.data, {
    targetLanguage: 'Russian',
    model: 'gemini-3.5-flash-lite',
    apiKey: 'AIzaSyTestApiKey123'
  });
});

test('validateSettings trims input values', () => {
  const result = validateSettings({
    targetLanguage: '  Spanish  ',
    model: '  gemini-1.5-pro  ',
    apiKey: '  AIzaSyTrimmedKey  '
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.data, {
    targetLanguage: 'Spanish',
    model: 'gemini-1.5-pro',
    apiKey: 'AIzaSyTrimmedKey'
  });
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

test('validateSettings fails when model is empty or contains invalid characters', () => {
  const emptyModel = validateSettings({
    targetLanguage: 'German',
    model: '',
    apiKey: 'AIzaSyKey'
  });

  assert.equal(emptyModel.valid, false);
  assert.equal(emptyModel.field, 'model');

  const invalidModelChars = validateSettings({
    targetLanguage: 'German',
    model: 'gemini@#$$%',
    apiKey: 'AIzaSyKey'
  });

  assert.equal(invalidModelChars.valid, false);
  assert.equal(invalidModelChars.field, 'model');
  assert.match(invalidModelChars.error, /invalid gemini model/i);

  const spacesInModel = validateSettings({
    targetLanguage: 'German',
    model: 'gemini 1.5 flash',
    apiKey: 'AIzaSyKey'
  });

  assert.equal(spacesInModel.valid, false);
  assert.equal(spacesInModel.field, 'model');
});

test('validateSettings fails when apiKey is empty or missing', () => {
  const emptyKey = validateSettings({
    targetLanguage: 'French',
    model: 'gemini-3.5-flash-lite',
    apiKey: ''
  });

  assert.equal(emptyKey.valid, false);
  assert.equal(emptyKey.field, 'apiKey');
  assert.match(emptyKey.error, /api key/i);

  const undefinedKey = validateSettings({
    targetLanguage: 'French',
    model: 'gemini-3.5-flash-lite'
  });

  assert.equal(undefinedKey.valid, false);
  assert.equal(undefinedKey.field, 'apiKey');
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

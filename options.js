import { DEFAULT_GEMINI_MODEL } from './gemini.js';

console.log('LLM-Translator: Options script loaded');

let statusTimeoutId = null;

/**
 * Validates extension options input fields.
 * Pure function: zero side-effects, no chrome.* or DOM dependencies.
 *
 * @param {object} settings
 * @param {string} [settings.targetLanguage]
 * @param {string} [settings.model]
 * @param {string} [settings.apiKey]
 * @returns {{ valid: boolean, field?: string, error?: string, data?: { targetLanguage: string, model: string, apiKey: string } }}
 */
export function validateSettings(settings = {}) {
  const targetLanguage = typeof settings.targetLanguage === 'string' ? settings.targetLanguage.trim() : '';
  const model = typeof settings.model === 'string' ? settings.model.trim() : '';
  const apiKey = typeof settings.apiKey === 'string' ? settings.apiKey.trim() : '';

  if (!targetLanguage) {
    return {
      valid: false,
      field: 'targetLanguage',
      error: 'Please enter a target language.'
    };
  }

  if (!model) {
    return {
      valid: false,
      field: 'model',
      error: 'Please enter a Gemini model name.'
    };
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(model)) {
    return {
      valid: false,
      field: 'model',
      error: 'Invalid Gemini model name. Use letters, numbers, dots, hyphens, or underscores.'
    };
  }

  if (!apiKey) {
    return {
      valid: false,
      field: 'apiKey',
      error: 'Please enter your Google AI Studio API key.'
    };
  }

  return {
    valid: true,
    data: {
      targetLanguage,
      model,
      apiKey
    }
  };
}

/**
 * Displays status or error alert in the aria-live status container.
 *
 * @param {HTMLElement} statusEl - Target DOM element.
 * @param {string} message - Message text to display.
 * @param {'success'|'error'|'loading'|'info'} [type='info'] - Status type.
 * @param {number} [autoHideMs=0] - Duration in ms before automatically clearing status.
 */
export function showStatusMessage(statusEl, message, type = 'info', autoHideMs = 0) {
  if (!statusEl) return;

  if (statusTimeoutId) {
    clearTimeout(statusTimeoutId);
    statusTimeoutId = null;
  }

  statusEl.textContent = message;
  statusEl.className = `status-message visible ${type}`;

  if (autoHideMs > 0) {
    statusTimeoutId = setTimeout(() => {
      statusEl.className = 'status-message';
      statusEl.textContent = '';
      statusTimeoutId = null;
    }, autoHideMs);
  }
}

/**
 * Clears and hides the status message.
 *
 * @param {HTMLElement} statusEl - Target DOM element.
 */
export function hideStatusMessage(statusEl) {
  if (!statusEl) return;
  if (statusTimeoutId) {
    clearTimeout(statusTimeoutId);
    statusTimeoutId = null;
  }
  statusEl.className = 'status-message';
  statusEl.textContent = '';
}

/**
 * Initializes options page event listeners and loads stored settings.
 */
export function initOptionsPage() {
  const form = document.getElementById('settings-form');
  const targetLanguageInput = document.getElementById('targetLanguage');
  const modelInput = document.getElementById('model');
  const apiKeyInput = document.getElementById('apiKey');
  const toggleApiKeyBtn = document.getElementById('toggle-api-key');
  const saveBtn = document.getElementById('save-btn');
  const testConnectionBtn = document.getElementById('test-connection-btn');
  const statusEl = document.getElementById('status-message');

  if (!form) return;

  // Load saved settings from local storage
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.get(['targetLanguage', 'baseLanguage', 'model', 'apiKey'], (settings) => {
      if (chrome.runtime.lastError) {
        showStatusMessage(
          statusEl,
          'Error loading settings: ' + chrome.runtime.lastError.message,
          'error'
        );
        return;
      }
      const targetLanguage = settings.targetLanguage || settings.baseLanguage || '';
      const model = settings.model || DEFAULT_GEMINI_MODEL;
      const apiKey = settings.apiKey || '';

      if (targetLanguage) targetLanguageInput.value = targetLanguage;
      modelInput.value = model;
      if (apiKey) apiKeyInput.value = apiKey;
    });
  }

  // Password visibility toggle
  if (toggleApiKeyBtn && apiKeyInput) {
    toggleApiKeyBtn.addEventListener('click', () => {
      const isPassword = apiKeyInput.type === 'password';
      apiKeyInput.type = isPassword ? 'text' : 'password';
      toggleApiKeyBtn.textContent = isPassword ? '🙈' : '👁';
      const newLabel = isPassword ? 'Hide API key' : 'Show API key';
      toggleApiKeyBtn.setAttribute('aria-label', newLabel);
      toggleApiKeyBtn.setAttribute('title', newLabel);
      apiKeyInput.focus();
    });
  }

  // Save Settings handler
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const validation = validateSettings({
      targetLanguage: targetLanguageInput.value,
      model: modelInput.value,
      apiKey: apiKeyInput.value
    });

    if (!validation.valid) {
      showStatusMessage(statusEl, validation.error, 'error');
      if (validation.field === 'targetLanguage') targetLanguageInput.focus();
      else if (validation.field === 'model') modelInput.focus();
      else if (validation.field === 'apiKey') apiKeyInput.focus();
      return;
    }

    const { targetLanguage, model, apiKey } = validation.data;

    saveBtn.disabled = true;
    if (testConnectionBtn) testConnectionBtn.disabled = true;

    chrome.storage.local.set({ targetLanguage, model, apiKey }, () => {
      saveBtn.disabled = false;
      if (testConnectionBtn) testConnectionBtn.disabled = false;

      if (chrome.runtime.lastError) {
        showStatusMessage(
          statusEl,
          'Error saving settings: ' + chrome.runtime.lastError.message,
          'error'
        );
      } else {
        showStatusMessage(statusEl, 'Settings saved successfully!', 'success', 3500);
      }
    });
  });

  // Test Connection handler
  if (testConnectionBtn) {
    testConnectionBtn.addEventListener('click', () => {
      const validation = validateSettings({
        targetLanguage: targetLanguageInput.value,
        model: modelInput.value,
        apiKey: apiKeyInput.value
      });

      if (!validation.valid) {
        showStatusMessage(statusEl, validation.error, 'error');
        if (validation.field === 'targetLanguage') targetLanguageInput.focus();
        else if (validation.field === 'model') modelInput.focus();
        else if (validation.field === 'apiKey') apiKeyInput.focus();
        return;
      }

      const { targetLanguage, model, apiKey } = validation.data;

      saveBtn.disabled = true;
      testConnectionBtn.disabled = true;
      showStatusMessage(statusEl, 'Testing connection to Gemini API...', 'loading');

      chrome.runtime.sendMessage(
        {
          type: 'connection.test',
          apiKey,
          model,
          targetLanguage
        },
        (response) => {
          saveBtn.disabled = false;
          testConnectionBtn.disabled = false;

          if (chrome.runtime.lastError) {
            showStatusMessage(
              statusEl,
              'Communication error: ' + chrome.runtime.lastError.message,
              'error'
            );
            return;
          }

          if (response?.ok) {
            showStatusMessage(
              statusEl,
              'Connection successful! Gemini API is configured and operational.',
              'success'
            );
          } else {
            const error = response?.error;
            let message = 'Connection test failed.';

            if (error?.code === 'AUTH') {
              message = 'Authentication failed: invalid API key or insufficient permissions.';
            } else if (error?.code === 'BAD_RESPONSE' && error.message?.includes('model')) {
              message = 'Requested Gemini model not found or unavailable.';
            } else if (error?.code === 'NETWORK') {
              message = 'Network error: unable to reach Gemini API. Please check your internet connection.';
            } else if (error?.code === 'RATE_LIMIT') {
              message = 'Rate limit exceeded. Please wait a moment and try again.';
            } else if (error?.message) {
              message = error.message;
            }

            showStatusMessage(statusEl, message, 'error');
          }
        }
      );
    });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOptionsPage);
  } else {
    initOptionsPage();
  }
}

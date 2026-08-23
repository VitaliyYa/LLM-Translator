import { DEFAULT_GEMINI_MODEL } from './gemini.js';
import { DEFAULT_OPENAI_MODEL, DEFAULT_OPENAI_ENDPOINT } from './openai.js';

console.log('LLM-Translator: Options script loaded');

let statusTimeoutId = null;

/**
 * Validates extension options input fields.
 * Pure function: zero side-effects, no chrome.* or DOM dependencies.
 *
 * @param {object} settings
 * @param {string} [settings.provider]
 * @param {string} [settings.targetLanguage]
 * @param {string} [settings.model]
 * @param {string} [settings.apiKey]
 * @param {string} [settings.customEndpoint]
 * @param {string} [settings.customModel]
 * @param {string} [settings.customApiKey]
 * @returns {{ valid: boolean, field?: string, error?: string, data?: object }}
 */
export function validateSettings(settings = {}) {
  const provider = settings.provider === 'openai_compatible' ? 'openai_compatible' : 'gemini';
  const targetLanguage = typeof settings.targetLanguage === 'string' ? settings.targetLanguage.trim() : '';
  const model = typeof settings.model === 'string' ? settings.model.trim() : '';
  const apiKey = typeof settings.apiKey === 'string' ? settings.apiKey.trim() : '';
  const customEndpoint = typeof settings.customEndpoint === 'string' ? settings.customEndpoint.trim() : '';
  const customModel = typeof settings.customModel === 'string' ? settings.customModel.trim() : '';
  const customApiKey = typeof settings.customApiKey === 'string' ? settings.customApiKey.trim() : '';

  if (!targetLanguage) {
    return {
      valid: false,
      field: 'targetLanguage',
      error: 'Please enter a target language.'
    };
  }

  if (provider === 'openai_compatible') {
    if (!customEndpoint) {
      return {
        valid: false,
        field: 'customEndpoint',
        error: 'Please enter an API endpoint URL.'
      };
    }

    try {
      const urlToTest = /^https?:\/\//i.test(customEndpoint) ? customEndpoint : `https://${customEndpoint}`;
      new URL(urlToTest);
    } catch (_) {
      return {
        valid: false,
        field: 'customEndpoint',
        error: 'Invalid API endpoint URL format.'
      };
    }

    if (!customModel) {
      return {
        valid: false,
        field: 'customModel',
        error: 'Please enter a model name.'
      };
    }
  } else {
    // Gemini validation
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
  }

  return {
    valid: true,
    data: {
      provider,
      targetLanguage,
      model: model || DEFAULT_GEMINI_MODEL,
      apiKey,
      customEndpoint: customEndpoint || DEFAULT_OPENAI_ENDPOINT,
      customModel: customModel || DEFAULT_OPENAI_MODEL,
      customApiKey
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
  const providerSelect = document.getElementById('provider');
  const targetLanguageInput = document.getElementById('targetLanguage');

  const geminiSection = document.getElementById('gemini-section');
  const modelInput = document.getElementById('model');
  const apiKeyInput = document.getElementById('apiKey');
  const toggleApiKeyBtn = document.getElementById('toggle-api-key');

  const openaiSection = document.getElementById('openai-section');
  const customEndpointInput = document.getElementById('customEndpoint');
  const customModelInput = document.getElementById('customModel');
  const customApiKeyInput = document.getElementById('customApiKey');
  const toggleCustomApiKeyBtn = document.getElementById('toggle-custom-api-key');

  const saveBtn = document.getElementById('save-btn');
  const testConnectionBtn = document.getElementById('test-connection-btn');
  const statusEl = document.getElementById('status-message');

  if (!form) return;

  function updateProviderVisibility(provider) {
    if (provider === 'openai_compatible') {
      if (geminiSection) geminiSection.classList.add('hidden');
      if (openaiSection) openaiSection.classList.remove('hidden');
    } else {
      if (geminiSection) geminiSection.classList.remove('hidden');
      if (openaiSection) openaiSection.classList.add('hidden');
    }
  }

  if (providerSelect) {
    providerSelect.addEventListener('change', () => {
      updateProviderVisibility(providerSelect.value);
    });
  }

  // Load saved settings from local storage
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.get([
      'provider',
      'targetLanguage',
      'baseLanguage',
      'model',
      'apiKey',
      'customEndpoint',
      'customModel',
      'customApiKey'
    ], (settings) => {
      if (chrome.runtime.lastError) {
        showStatusMessage(
          statusEl,
          'Error loading settings: ' + chrome.runtime.lastError.message,
          'error'
        );
        return;
      }
      const provider = settings.provider || 'gemini';
      const targetLanguage = settings.targetLanguage || settings.baseLanguage || '';
      const model = settings.model || DEFAULT_GEMINI_MODEL;
      const apiKey = settings.apiKey || '';
      const customEndpoint = settings.customEndpoint || DEFAULT_OPENAI_ENDPOINT;
      const customModel = settings.customModel || DEFAULT_OPENAI_MODEL;
      const customApiKey = settings.customApiKey || '';

      if (providerSelect) providerSelect.value = provider;
      if (targetLanguage) targetLanguageInput.value = targetLanguage;
      if (modelInput) modelInput.value = model;
      if (apiKeyInput && apiKey) apiKeyInput.value = apiKey;
      if (customEndpointInput) customEndpointInput.value = customEndpoint;
      if (customModelInput) customModelInput.value = customModel;
      if (customApiKeyInput && customApiKey) customApiKeyInput.value = customApiKey;

      updateProviderVisibility(provider);
    });
  }

  // Password visibility toggle helpers
  function setupPasswordToggle(toggleBtn, inputEl) {
    if (!toggleBtn || !inputEl) return;
    toggleBtn.addEventListener('click', () => {
      const isPassword = inputEl.type === 'password';
      inputEl.type = isPassword ? 'text' : 'password';
      toggleBtn.textContent = isPassword ? '🙈' : '👁';
      const newLabel = isPassword ? 'Hide API key' : 'Show API key';
      toggleBtn.setAttribute('aria-label', newLabel);
      toggleBtn.setAttribute('title', newLabel);
      inputEl.focus();
    });
  }

  setupPasswordToggle(toggleApiKeyBtn, apiKeyInput);
  setupPasswordToggle(toggleCustomApiKeyBtn, customApiKeyInput);

  // Save Settings handler
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const selectedProvider = providerSelect ? providerSelect.value : 'gemini';

    const validation = validateSettings({
      provider: selectedProvider,
      targetLanguage: targetLanguageInput?.value,
      model: modelInput?.value,
      apiKey: apiKeyInput?.value,
      customEndpoint: customEndpointInput?.value,
      customModel: customModelInput?.value,
      customApiKey: customApiKeyInput?.value
    });

    if (!validation.valid) {
      showStatusMessage(statusEl, validation.error, 'error');
      if (validation.field === 'targetLanguage') targetLanguageInput?.focus();
      else if (validation.field === 'model') modelInput?.focus();
      else if (validation.field === 'apiKey') apiKeyInput?.focus();
      else if (validation.field === 'customEndpoint') customEndpointInput?.focus();
      else if (validation.field === 'customModel') customModelInput?.focus();
      return;
    }

    const {
      provider,
      targetLanguage,
      model,
      apiKey,
      customEndpoint,
      customModel,
      customApiKey
    } = validation.data;

    saveBtn.disabled = true;
    if (testConnectionBtn) testConnectionBtn.disabled = true;

    chrome.storage.local.set({
      provider,
      targetLanguage,
      model,
      apiKey,
      customEndpoint,
      customModel,
      customApiKey
    }, () => {
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
      const selectedProvider = providerSelect ? providerSelect.value : 'gemini';

      const validation = validateSettings({
        provider: selectedProvider,
        targetLanguage: targetLanguageInput?.value,
        model: modelInput?.value,
        apiKey: apiKeyInput?.value,
        customEndpoint: customEndpointInput?.value,
        customModel: customModelInput?.value,
        customApiKey: customApiKeyInput?.value
      });

      if (!validation.valid) {
        showStatusMessage(statusEl, validation.error, 'error');
        if (validation.field === 'targetLanguage') targetLanguageInput?.focus();
        else if (validation.field === 'model') modelInput?.focus();
        else if (validation.field === 'apiKey') apiKeyInput?.focus();
        else if (validation.field === 'customEndpoint') customEndpointInput?.focus();
        else if (validation.field === 'customModel') customModelInput?.focus();
        return;
      }

      const {
        provider,
        targetLanguage,
        model,
        apiKey,
        customEndpoint,
        customModel,
        customApiKey
      } = validation.data;

      saveBtn.disabled = true;
      testConnectionBtn.disabled = true;
      const providerLabel = provider === 'openai_compatible' ? 'Custom / OpenRouter' : 'Gemini';
      showStatusMessage(statusEl, `Testing connection to ${providerLabel} API...`, 'loading');

      chrome.runtime.sendMessage(
        {
          type: 'connection.test',
          provider,
          targetLanguage,
          model,
          apiKey,
          customEndpoint,
          customModel,
          customApiKey
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
              `Connection successful! ${providerLabel} API is configured and operational.`,
              'success'
            );
          } else {
            const error = response?.error;
            let message = 'Connection test failed.';

            if (error?.code === 'AUTH') {
              message = 'Authentication failed: invalid API key or insufficient permissions.';
            } else if (error?.code === 'BAD_RESPONSE' && error.message?.includes('model')) {
              message = 'Requested model not found or unavailable.';
            } else if (error?.code === 'NETWORK') {
              message = 'Network error: unable to reach API. Please check your endpoint URL and connection.';
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

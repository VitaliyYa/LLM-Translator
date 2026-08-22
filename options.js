console.log('LLM-Translator: Options script loaded');

const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings from local storage
  chrome.storage.local.get(['targetLanguage', 'baseLanguage', 'model', 'apiKey'], (settings) => {
    const targetLanguage = settings.targetLanguage || settings.baseLanguage || '';
    const model = settings.model || DEFAULT_GEMINI_MODEL;
    const apiKey = settings.apiKey || '';

    if (targetLanguage) {
      document.getElementById('targetLanguage').value = targetLanguage;
    }
    document.getElementById('model').value = model;
    if (apiKey) {
      document.getElementById('apiKey').value = apiKey;
    }
  });

  document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const targetLanguage = document.getElementById('targetLanguage').value.trim();
    const model = document.getElementById('model').value.trim();
    const apiKey = document.getElementById('apiKey').value.trim();
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = '';

    if (!targetLanguage || !apiKey) {
      messageDiv.textContent = 'Please fill in all required fields.';
      messageDiv.className = 'error';
      return;
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(model)) {
      messageDiv.textContent = 'Invalid Gemini model name.';
      messageDiv.className = 'error';
      return;
    }

    chrome.storage.local.set({ targetLanguage, model, apiKey }, () => {
      if (chrome.runtime.lastError) {
        messageDiv.textContent = 'Error saving settings: ' + chrome.runtime.lastError.message;
        messageDiv.className = 'error';
      } else {
        messageDiv.textContent = 'Settings saved!';
        messageDiv.className = 'status';
      }
    });
  });
});

console.log('LLM-Translator: Options script loaded');

const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

document.addEventListener('DOMContentLoaded', () => {
  console.log('LLM-Translator [Options]: Options page loaded');

  // Check URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('baseLanguage') || urlParams.has('model') || urlParams.has('apiKey')) {
    console.log('LLM-Translator [Options]: URL parameters detected');
    const baseLanguageFromUrl = urlParams.get('baseLanguage');
    const modelFromUrl = urlParams.get('model');
    const apiKeyFromUrl = urlParams.get('apiKey');
    
    if (baseLanguageFromUrl) document.getElementById('baseLanguage').value = baseLanguageFromUrl;
    if (modelFromUrl) document.getElementById('model').value = modelFromUrl;
    if (apiKeyFromUrl) document.getElementById('apiKey').value = apiKeyFromUrl;
    
    console.log('LLM-Translator [Options]: Fields filled from URL parameters');
  }

  // Load saved settings
  console.log('LLM-Translator [Options]: Loading saved settings');
  chrome.storage.sync.get(['baseLanguage', 'model', 'apiKey'], (settings) => {
    console.log('LLM-Translator [Options]: Settings received from storage', {
      baseLanguage: settings.baseLanguage || 'not set',
      model: settings.model || DEFAULT_GEMINI_MODEL,
      apiKey: settings.apiKey ? 'set (hidden)' : 'not set'
    });

    if (settings.baseLanguage) document.getElementById('baseLanguage').value = settings.baseLanguage;
    document.getElementById('model').value = settings.model || DEFAULT_GEMINI_MODEL;
    if (settings.apiKey) document.getElementById('apiKey').value = settings.apiKey;
    
    console.log('LLM-Translator [Options]: Fields filled from storage');
  });
  
  document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    console.log('LLM-Translator [Options]: Settings form submitted');
    
    const baseLanguage = document.getElementById('baseLanguage').value.trim();
    const model = document.getElementById('model').value.trim();
    const apiKey = document.getElementById('apiKey').value.trim();
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = '';
    
    console.log('LLM-Translator [Options]: Validating entered values:', {
      baseLanguage,
      model,
      apiKey: apiKey ? '[set]' : '[empty]'
    });
    
    if (!/^[a-zA-Z0-9._-]+$/.test(model)) {
      console.error('LLM-Translator [Options]: Invalid Gemini model name');
      messageDiv.textContent = 'Invalid Gemini model name.';
      messageDiv.className = 'error';
      return;
    }
    
    console.log('LLM-Translator [Options]: Saving settings');
    chrome.storage.sync.set({ baseLanguage, model, apiKey }, () => {
      if (chrome.runtime.lastError) {
        console.error('LLM-Translator [Options]: Error saving settings:', chrome.runtime.lastError);
        messageDiv.textContent = 'Error saving settings: ' + chrome.runtime.lastError.message;
        messageDiv.className = 'error';
      } else {
        console.log('LLM-Translator [Options]: Settings saved successfully');
        messageDiv.textContent = 'Settings saved!';
        messageDiv.className = 'status';
      }
    });
  });
});

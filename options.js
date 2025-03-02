console.log('LLM-Translator: Options script loaded');

document.addEventListener('DOMContentLoaded', () => {
  console.log('LLM-Translator [Options]: Options page loaded');

  // Check URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('baseLanguage') || urlParams.has('apiUrl') || urlParams.has('apiKey')) {
    console.log('LLM-Translator [Options]: URL parameters detected');
    const baseLanguageFromUrl = urlParams.get('baseLanguage');
    const apiUrlFromUrl = urlParams.get('apiUrl');
    const apiKeyFromUrl = urlParams.get('apiKey');
    
    if (baseLanguageFromUrl) document.getElementById('baseLanguage').value = baseLanguageFromUrl;
    if (apiUrlFromUrl) document.getElementById('apiUrl').value = apiUrlFromUrl;
    if (apiKeyFromUrl) document.getElementById('apiKey').value = apiKeyFromUrl;
    
    console.log('LLM-Translator [Options]: Fields filled from URL parameters');
  }

  // Load saved settings
  console.log('LLM-Translator [Options]: Loading saved settings');
  chrome.storage.sync.get(['baseLanguage', 'apiUrl', 'apiKey'], (settings) => {
    console.log('LLM-Translator [Options]: Settings received from storage', {
      baseLanguage: settings.baseLanguage || 'not set',
      apiUrl: settings.apiUrl ? `${settings.apiUrl.substring(0, 30)}...` : 'not set',
      apiKey: settings.apiKey ? 'set (hidden)' : 'not set'
    });

    if (settings.baseLanguage) document.getElementById('baseLanguage').value = settings.baseLanguage;
    if (settings.apiUrl) document.getElementById('apiUrl').value = settings.apiUrl;
    if (settings.apiKey) document.getElementById('apiKey').value = settings.apiKey;
    
    console.log('LLM-Translator [Options]: Fields filled from storage');
  });
  
  document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    console.log('LLM-Translator [Options]: Settings form submitted');
    
    const baseLanguage = document.getElementById('baseLanguage').value.trim();
    const apiUrl = document.getElementById('apiUrl').value.trim();
    const apiKey = document.getElementById('apiKey').value.trim();
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = '';
    
    console.log('LLM-Translator [Options]: Validating entered values:', {
      baseLanguage,
      apiUrl: `${apiUrl.substring(0, 30)}...`,
      apiKey: apiKey ? '[set]' : '[empty]'
    });
    
    // Basic URL validation
    try {
      new URL(apiUrl);
    } catch (err) {
      console.error('LLM-Translator [Options]: Invalid API URL:', err);
      messageDiv.textContent = 'Invalid API URL.';
      messageDiv.className = 'error';
      return;
    }
    
    console.log('LLM-Translator [Options]: Saving settings');
    chrome.storage.sync.set({ baseLanguage, apiUrl, apiKey }, () => {
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
import {
  translateWithGemini,
  normalizeGeminiError,
  DEFAULT_GEMINI_MODEL,
  MAX_INPUT_LENGTH
} from './gemini.js';

console.log('LLM-Translator: Background service worker loaded');

async function getSettings() {
  const localSettings = await chrome.storage.local.get(['targetLanguage', 'baseLanguage', 'model', 'apiKey']);
  let { targetLanguage, baseLanguage, model, apiKey } = localSettings;

  // Automatic first-run migration from chrome.storage.sync
  if (!targetLanguage && !apiKey) {
    try {
      const syncSettings = await chrome.storage.sync.get(['targetLanguage', 'baseLanguage', 'model', 'apiKey']);
      const syncLanguage = syncSettings.targetLanguage || syncSettings.baseLanguage;
      const syncApiKey = syncSettings.apiKey;
      const syncModel = syncSettings.model;

      if (syncLanguage || syncApiKey) {
        targetLanguage = syncLanguage || targetLanguage;
        apiKey = syncApiKey || apiKey;
        model = syncModel || model || DEFAULT_GEMINI_MODEL;

        await chrome.storage.local.set({
          targetLanguage: targetLanguage || '',
          model: model || DEFAULT_GEMINI_MODEL,
          apiKey: apiKey || ''
        });

        await chrome.storage.sync.remove(['baseLanguage', 'targetLanguage', 'model', 'apiKey']);
      }
    } catch (migrationError) {
      // Silently ignore sync access issues
    }
  } else if (baseLanguage && !targetLanguage) {
    targetLanguage = baseLanguage;
    await chrome.storage.local.set({ targetLanguage });
    await chrome.storage.local.remove('baseLanguage');
  }

  return {
    targetLanguage: targetLanguage || '',
    model: model || DEFAULT_GEMINI_MODEL,
    apiKey: apiKey || ''
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'connection.test') {
    (async () => {
      try {
        const apiKey = (message.apiKey || '').trim();
        const model = (message.model || '').trim() || DEFAULT_GEMINI_MODEL;
        const targetLanguage = (message.targetLanguage || '').trim() || 'English';

        if (!apiKey) {
          const normalized = normalizeGeminiError({
            code: 'SETTINGS_MISSING',
            message: 'API key is required.'
          });
          sendResponse({ ok: false, error: normalized });
          return;
        }

        await translateWithGemini({
          apiKey,
          model,
          targetLanguage,
          text: 'Ping'
        });

        sendResponse({ ok: true });
      } catch (err) {
        console.error('LLM-Translator [Background]: Connection test failed');
        const normalized = normalizeGeminiError(err);
        sendResponse({ ok: false, error: normalized });
      }
    })();

    return true;
  }

  if (message.type === 'translation.request' || message.type === 'translateText') {
    const isLegacy = message.type === 'translateText';
    const requestId = message.requestId || null;

    (async () => {
      try {
        const { targetLanguage, model, apiKey } = await getSettings();

        if (!targetLanguage || !apiKey) {
          const normalized = normalizeGeminiError({
            code: 'SETTINGS_MISSING',
            message: 'Settings not configured. Please check extension options.'
          });
          if (isLegacy) {
            sendResponse({ error: normalized.message });
          } else {
            sendResponse({ requestId, ok: false, error: normalized });
          }
          return;
        }

        if (typeof message.text !== 'string' || message.text.length > MAX_INPUT_LENGTH) {
          const normalized = normalizeGeminiError({
            code: 'TEXT_TOO_LONG',
            message: `Selected text exceeds the ${MAX_INPUT_LENGTH.toLocaleString()} character limit.`
          });
          if (isLegacy) {
            sendResponse({ error: normalized.message });
          } else {
            sendResponse({ requestId, ok: false, error: normalized });
          }
          return;
        }

        const translation = await translateWithGemini({
          apiKey,
          model,
          targetLanguage,
          text: message.text
        });

        if (isLegacy) {
          sendResponse({ translation });
        } else {
          sendResponse({ requestId, ok: true, translation });
        }
      } catch (err) {
        console.error('LLM-Translator [Background]: Translation failed');
        const normalized = normalizeGeminiError(err);
        if (isLegacy) {
          sendResponse({ error: normalized.message });
        } else {
          sendResponse({ requestId, ok: false, error: normalized });
        }
      }
    })();

    // Return true so sendResponse can be called asynchronously
    return true;
  }
});

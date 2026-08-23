import {
  translateWithGemini,
  normalizeGeminiError,
  DEFAULT_GEMINI_MODEL,
  MAX_INPUT_LENGTH
} from './gemini.js';
import {
  translateWithOpenAI,
  normalizeOpenAIError,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_OPENAI_ENDPOINT
} from './openai.js';

console.log('LLM-Translator: Background service worker loaded');

async function getSettings() {
  const localSettings = await chrome.storage.local.get([
    'provider',
    'targetLanguage',
    'baseLanguage',
    'model',
    'apiKey',
    'customEndpoint',
    'customModel',
    'customApiKey'
  ]);

  let {
    provider,
    targetLanguage,
    baseLanguage,
    model,
    apiKey,
    customEndpoint,
    customModel,
    customApiKey
  } = localSettings;

  // Default provider to gemini
  provider = provider || 'gemini';

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
          provider: 'gemini',
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
    provider,
    targetLanguage: targetLanguage || '',
    model: model || DEFAULT_GEMINI_MODEL,
    apiKey: apiKey || '',
    customEndpoint: customEndpoint || DEFAULT_OPENAI_ENDPOINT,
    customModel: customModel || DEFAULT_OPENAI_MODEL,
    customApiKey: customApiKey || ''
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'connection.test') {
    (async () => {
      try {
        const provider = message.provider || 'gemini';
        const targetLanguage = (message.targetLanguage || '').trim() || 'English';

        if (provider === 'openai_compatible') {
          const customEndpoint = (message.customEndpoint || '').trim() || DEFAULT_OPENAI_ENDPOINT;
          const customModel = (message.customModel || '').trim() || DEFAULT_OPENAI_MODEL;
          const customApiKey = (message.customApiKey || '').trim();

          await translateWithOpenAI({
            endpoint: customEndpoint,
            apiKey: customApiKey,
            model: customModel,
            targetLanguage,
            text: 'Ping'
          });

          sendResponse({ ok: true });
        } else {
          const apiKey = (message.apiKey || '').trim();
          const model = (message.model || '').trim() || DEFAULT_GEMINI_MODEL;

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
        }
      } catch (err) {
        console.error('LLM-Translator [Background]: Connection test failed');
        const provider = message.provider || 'gemini';
        const normalized = provider === 'openai_compatible'
          ? normalizeOpenAIError(err)
          : normalizeGeminiError(err);
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
        const settings = await getSettings();
        const { provider, targetLanguage } = settings;

        if (!targetLanguage) {
          const normalized = normalizeGeminiError({
            code: 'SETTINGS_MISSING',
            message: 'Target language is not configured. Please check extension options.'
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

        let translation = '';

        if (provider === 'openai_compatible') {
          const { customEndpoint, customModel, customApiKey } = settings;
          if (!customEndpoint) {
            const normalized = normalizeOpenAIError({
              code: 'SETTINGS_MISSING',
              message: 'Custom endpoint URL is required. Please check extension options.'
            });
            if (isLegacy) {
              sendResponse({ error: normalized.message });
            } else {
              sendResponse({ requestId, ok: false, error: normalized });
            }
            return;
          }

          translation = await translateWithOpenAI({
            endpoint: customEndpoint,
            apiKey: customApiKey,
            model: customModel,
            targetLanguage,
            text: message.text
          });
        } else {
          const { apiKey, model } = settings;
          if (!apiKey) {
            const normalized = normalizeGeminiError({
              code: 'SETTINGS_MISSING',
              message: 'Gemini API key is required. Please check extension options.'
            });
            if (isLegacy) {
              sendResponse({ error: normalized.message });
            } else {
              sendResponse({ requestId, ok: false, error: normalized });
            }
            return;
          }

          translation = await translateWithGemini({
            apiKey,
            model,
            targetLanguage,
            text: message.text
          });
        }

        if (isLegacy) {
          sendResponse({ translation });
        } else {
          sendResponse({ requestId, ok: true, translation });
        }
      } catch (err) {
        console.error('LLM-Translator [Background]: Translation failed');
        const settings = await getSettings();
        const normalized = settings?.provider === 'openai_compatible'
          ? normalizeOpenAIError(err)
          : normalizeGeminiError(err);

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

// ==========================================================================
// LLM-Translator Content Script (Shadow DOM, a11y, Themes)
// ==========================================================================

// Finite State Machine states
const State = {
  IDLE: 'IDLE',
  SELECTED: 'SELECTED',
  LOADING: 'LOADING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR'
};

let currentState = State.IDLE;
let currentRequestId = null;
let savedSelectionText = '';
let savedPosition = null;

let hostElement = null;
let shadowRoot = null;
let translatorButton = null;
let translationPopup = null;
const activeTimerIds = new Set();

console.log('LLM-Translator: Content script loaded');

/**
 * Escapes special HTML characters to prevent XSS.
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Registers a tracked setTimeout so it can be cleanly cancelled in cleanup().
 */
function setTrackedTimeout(fn, delayMs) {
  const timerId = setTimeout(() => {
    activeTimerIds.delete(timerId);
    fn();
  }, delayMs);
  activeTimerIds.add(timerId);
  return timerId;
}

/**
 * Clears all pending tracked timers.
 */
function clearTrackedTimers() {
  for (const timerId of activeTimerIds) {
    clearTimeout(timerId);
  }
  activeTimerIds.clear();
}

/**
 * Generates a unique requestId for request correlation.
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Ensures the open Shadow DOM host container and encapsulated styles are mounted.
 */
function ensureShadowRoot() {
  if (!hostElement || !hostElement.isConnected) {
    hostElement = document.createElement('div');
    hostElement.id = 'llm-translator-host';
    hostElement.style.position = 'static';
    hostElement.style.margin = '0';
    hostElement.style.padding = '0';
    hostElement.style.border = '0';
    hostElement.style.width = '0';
    hostElement.style.height = '0';

    shadowRoot = hostElement.attachShadow({ mode: 'open' });

    const linkEl = document.createElement('link');
    linkEl.rel = 'stylesheet';
    linkEl.href = chrome.runtime.getURL('content.css');
    shadowRoot.appendChild(linkEl);

    (document.body || document.documentElement).appendChild(hostElement);
  }
  return shadowRoot;
}

/**
 * Centralized cleanup of UI elements, timers, and global document listeners.
 */
function cleanup() {
  clearTrackedTimers();

  if (translatorButton) {
    translatorButton.remove();
    translatorButton = null;
  }

  if (translationPopup) {
    translationPopup.remove();
    translationPopup = null;
  }

  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('click', handleDocumentClick);
}

/**
 * Handles Escape key to dismiss extension UI.
 */
function handleKeyDown(event) {
  if (event.key === 'Escape') {
    transitionTo(State.IDLE);
  }
}

/**
 * Handles clicks outside translator UI elements to dismiss modal popups.
 */
function handleDocumentClick(event) {
  const path = event.composedPath ? event.composedPath() : [];
  if (hostElement && (path.includes(hostElement) || hostElement.contains(event.target))) {
    return;
  }
  const selection = window.getSelection();
  const text = selection ? selection.toString().trim() : '';
  if (!text) {
    transitionTo(State.IDLE);
  }
}

/**
 * Positions a DOM element within the viewport across all 4 edges with scroll offsets.
 */
function positionElement(element, anchorPos) {
  const root = ensureShadowRoot();

  // Temporarily mount with hidden visibility to calculate dimensions
  element.style.visibility = 'hidden';
  element.style.top = '-9999px';
  element.style.left = '-9999px';
  root.appendChild(element);

  const elemWidth = element.offsetWidth || 300;
  const elemHeight = element.offsetHeight || 120;

  const anchorTop = anchorPos ? anchorPos.top : window.scrollY + 50;
  const anchorLeft = anchorPos ? anchorPos.left : window.scrollX + 50;
  const anchorHeight = 32;

  let desiredTop = anchorTop + anchorHeight + 4;
  let desiredLeft = anchorLeft;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollX = window.scrollX || window.pageXOffset || 0;
  const scrollY = window.scrollY || window.pageYOffset || 0;
  const buffer = 10;

  const minLeft = scrollX + buffer;
  const maxLeft = scrollX + viewportWidth - elemWidth - buffer;
  const minTop = scrollY + buffer;
  const maxTop = scrollY + viewportHeight - elemHeight - buffer;

  // Viewport horizontal clamping
  if (desiredLeft > maxLeft) {
    desiredLeft = maxLeft;
  }
  if (desiredLeft < minLeft) {
    desiredLeft = minLeft;
  }

  // Viewport vertical clamping and flipping
  if (desiredTop > maxTop) {
    const topAbove = anchorTop - elemHeight - 6;
    if (topAbove >= minTop) {
      desiredTop = topAbove;
    } else {
      desiredTop = Math.max(minTop, Math.min(desiredTop, maxTop));
    }
  }
  if (desiredTop < minTop) {
    desiredTop = minTop;
  }

  element.style.top = `${desiredTop}px`;
  element.style.left = `${desiredLeft}px`;
  element.style.visibility = 'visible';
}

/**
 * Copies text to clipboard with modern API and fallback support.
 */
async function copyToClipboard(text, copyButton) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
    }

    if (copyButton) {
      const originalText = copyButton.textContent;
      copyButton.textContent = 'Copied!';
      copyButton.classList.add('llm-btn-success');
      setTrackedTimeout(() => {
        if (copyButton && copyButton.isConnected) {
          copyButton.textContent = originalText;
          copyButton.classList.remove('llm-btn-success');
        }
      }, 1500);
    }
  } catch (err) {
    if (copyButton) {
      copyButton.textContent = 'Error';
      setTrackedTimeout(() => {
        if (copyButton && copyButton.isConnected) {
          copyButton.textContent = 'Copy';
        }
      }, 1500);
    }
  }
}

/**
 * Sanitizes user-facing error messages to avoid leaking URLs or raw API payloads.
 */
function getSanitizedErrorMessage(error) {
  if (!error) return 'Translation failed due to an unexpected error.';

  const code = error.code;
  switch (code) {
    case 'SETTINGS_MISSING':
      return 'Settings not configured. Please open extension options to set your API key and target language.';
    case 'TEXT_TOO_LONG':
      return 'Selected text exceeds the 10,000 character limit.';
    case 'TIMEOUT':
      return 'Translation request timed out after 30 seconds.';
    case 'AUTH':
      return 'Authentication failed: invalid API key or insufficient permissions.';
    case 'RATE_LIMIT':
      return 'API rate limit exceeded. Please wait a moment and try again.';
    case 'BLOCKED':
      return error.message && !error.message.includes('http') ? error.message : 'Translation was blocked by safety policy.';
    case 'NETWORK':
      return 'Network connection failed. Please check your internet connection.';
    case 'BAD_RESPONSE':
    default: {
      let msg = error.message || 'Translation failed.';
      msg = msg.replace(/https?:\/\/[^\s]+/g, '[API endpoint]');
      return msg;
    }
  }
}

/**
 * Creates and mounts the accessible translator trigger button within Shadow DOM.
 */
function createTranslatorButton(position) {
  if (translatorButton) {
    translatorButton.remove();
    translatorButton = null;
  }

  const root = ensureShadowRoot();

  translatorButton = document.createElement('button');
  translatorButton.type = 'button';
  translatorButton.className = 'llm-trigger-btn';
  translatorButton.setAttribute('aria-label', 'Translate selected text');
  translatorButton.setAttribute('title', 'Translate selected text');
  translatorButton.style.backgroundImage = `url("${chrome.runtime.getURL('icons/icon48.png')}")`;

  // Position the button clamped to viewport
  const scrollX = window.scrollX || window.pageXOffset || 0;
  const scrollY = window.scrollY || window.pageYOffset || 0;
  const buffer = 5;
  const btnSize = 32;

  let btnLeft = Math.max(scrollX + buffer, Math.min(position.left, scrollX + window.innerWidth - btnSize - buffer));
  let btnTop = Math.max(scrollY + buffer, Math.min(position.top, scrollY + window.innerHeight - btnSize - buffer));

  translatorButton.style.top = `${btnTop}px`;
  translatorButton.style.left = `${btnLeft}px`;

  // Prevent mousedown from dropping text selection
  translatorButton.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  // Handle click & keyboard (Enter/Space on button triggers click)
  translatorButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (currentState === State.SELECTED && savedSelectionText) {
      transitionTo(State.LOADING);
    }
  });

  root.appendChild(translatorButton);
}

/**
 * Displays the loading popup with a spinner immediately upon translation start.
 */
function showLoadingPopup() {
  if (translationPopup) {
    translationPopup.remove();
    translationPopup = null;
  }

  translationPopup = document.createElement('div');
  translationPopup.className = 'llm-popup';
  translationPopup.setAttribute('role', 'dialog');
  translationPopup.setAttribute('aria-label', 'Translation Loading');

  translationPopup.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });

  const loadingContainer = document.createElement('div');
  loadingContainer.className = 'llm-loading-container';

  const loadingBody = document.createElement('div');
  loadingBody.className = 'llm-loading-body';

  const spinner = document.createElement('div');
  spinner.className = 'llm-spinner';
  spinner.setAttribute('aria-hidden', 'true');

  const loadingText = document.createElement('span');
  loadingText.className = 'llm-loading-text';
  loadingText.setAttribute('aria-live', 'polite');
  loadingText.textContent = 'Translating...';

  loadingBody.appendChild(spinner);
  loadingBody.appendChild(loadingText);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'llm-btn';
  closeBtn.setAttribute('aria-label', 'Close translation');
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    transitionTo(State.IDLE);
  });

  loadingContainer.appendChild(loadingBody);
  loadingContainer.appendChild(closeBtn);
  translationPopup.appendChild(loadingContainer);

  positionElement(translationPopup, savedPosition);
}

/**
 * Displays the successful translation popup with text, Copy, and Close buttons.
 */
function showSuccessPopup(translationText) {
  if (translationPopup) {
    translationPopup.remove();
    translationPopup = null;
  }

  translationPopup = document.createElement('div');
  translationPopup.className = 'llm-popup';
  translationPopup.setAttribute('role', 'dialog');
  translationPopup.setAttribute('aria-label', 'Translation Result');

  translationPopup.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });

  const contentArea = document.createElement('div');
  contentArea.className = 'llm-popup-content';
  contentArea.setAttribute('tabindex', '0');

  const textParagraph = document.createElement('p');
  textParagraph.className = 'llm-translation-text';
  textParagraph.textContent = translationText;
  contentArea.appendChild(textParagraph);

  const footer = document.createElement('div');
  footer.className = 'llm-popup-footer';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'llm-btn llm-copy-btn';
  copyBtn.setAttribute('aria-label', 'Copy translation to clipboard');
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    copyToClipboard(translationText, copyBtn);
  });

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'llm-btn llm-close-btn';
  closeBtn.setAttribute('aria-label', 'Close translation');
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    transitionTo(State.IDLE);
  });

  footer.appendChild(copyBtn);
  footer.appendChild(closeBtn);

  translationPopup.appendChild(contentArea);
  translationPopup.appendChild(footer);

  positionElement(translationPopup, savedPosition);
}

/**
 * Displays the error popup with sanitized message, Retry, and Close buttons.
 */
function showErrorPopup(error) {
  if (translationPopup) {
    translationPopup.remove();
    translationPopup = null;
  }

  const sanitizedMessage = getSanitizedErrorMessage(error);

  translationPopup = document.createElement('div');
  translationPopup.className = 'llm-popup';
  translationPopup.setAttribute('role', 'dialog');
  translationPopup.setAttribute('aria-label', 'Translation Error');

  translationPopup.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });

  const contentArea = document.createElement('div');
  contentArea.className = 'llm-popup-content';

  const errorBox = document.createElement('div');
  errorBox.className = 'llm-error-box';

  const errorParagraph = document.createElement('p');
  errorParagraph.textContent = sanitizedMessage;
  errorBox.appendChild(errorParagraph);
  contentArea.appendChild(errorBox);

  const footer = document.createElement('div');
  footer.className = 'llm-popup-footer';

  const retryBtn = document.createElement('button');
  retryBtn.type = 'button';
  retryBtn.className = 'llm-btn llm-btn-primary llm-retry-btn';
  retryBtn.setAttribute('aria-label', 'Retry translation');
  retryBtn.textContent = 'Retry';
  retryBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (savedSelectionText) {
      transitionTo(State.LOADING);
    }
  });

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'llm-btn llm-close-btn';
  closeBtn.setAttribute('aria-label', 'Close translation');
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    transitionTo(State.IDLE);
  });

  footer.appendChild(retryBtn);
  footer.appendChild(closeBtn);

  translationPopup.appendChild(contentArea);
  translationPopup.appendChild(footer);

  positionElement(translationPopup, savedPosition);
}

/**
 * Finite State Machine transitions.
 */
function transitionTo(nextState, payload = {}) {
  switch (nextState) {
    case State.IDLE:
      cleanup();
      currentState = State.IDLE;
      currentRequestId = null;
      savedSelectionText = '';
      savedPosition = null;
      break;

    case State.SELECTED:
      cleanup();
      currentState = State.SELECTED;
      savedSelectionText = payload.text || '';
      savedPosition = payload.position || null;

      if (savedPosition) {
        createTranslatorButton(savedPosition);
        document.addEventListener('keydown', handleKeyDown);
      }
      break;

    case State.LOADING:
      currentState = State.LOADING;
      if (translatorButton) {
        translatorButton.remove();
        translatorButton = null;
      }

      showLoadingPopup();

      const requestId = generateRequestId();
      currentRequestId = requestId;

      document.addEventListener('keydown', handleKeyDown);
      setTrackedTimeout(() => {
        document.addEventListener('click', handleDocumentClick);
      }, 0);

      chrome.runtime.sendMessage(
        {
          type: 'translation.request',
          requestId,
          text: savedSelectionText
        },
        (response) => {
          // Gracefully catch runtime errors (e.g. extension invalidated on reload)
          if (chrome.runtime.lastError) {
            if (currentState === State.LOADING && currentRequestId === requestId) {
              transitionTo(State.ERROR, {
                error: {
                  code: 'NETWORK',
                  message: 'Extension connection interrupted. Please reload the page.'
                }
              });
            }
            return;
          }

          // Ignore stale or canceled requests
          if (!response || response.requestId !== currentRequestId || currentState !== State.LOADING) {
            return;
          }

          if (response.ok) {
            transitionTo(State.SUCCESS, { translation: response.translation });
          } else {
            transitionTo(State.ERROR, {
              error: response.error || { code: 'BAD_RESPONSE', message: 'Translation failed.' }
            });
          }
        }
      );
      break;

    case State.SUCCESS:
      currentState = State.SUCCESS;
      showSuccessPopup(payload.translation || '');
      document.addEventListener('keydown', handleKeyDown);
      setTrackedTimeout(() => {
        document.addEventListener('click', handleDocumentClick);
      }, 0);
      break;

    case State.ERROR:
      currentState = State.ERROR;
      showErrorPopup(payload.error || null);
      document.addEventListener('keydown', handleKeyDown);
      setTrackedTimeout(() => {
        document.addEventListener('click', handleDocumentClick);
      }, 0);
      break;

    default:
      console.warn(`LLM-Translator: Unknown state transition to ${nextState}`);
      break;
  }
}

/**
 * Text selection interception on mouseup.
 */
document.addEventListener('mouseup', (e) => {
  const path = e.composedPath ? e.composedPath() : [];

  // Ignore clicks inside existing extension Shadow DOM or host element
  if (hostElement && (path.includes(hostElement) || hostElement.contains(e.target))) {
    return;
  }

  setTrackedTimeout(() => {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';

    if (!text) {
      if (currentState === State.SELECTED) {
        transitionTo(State.IDLE);
      }
      return;
    }

    if (selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const rects = Array.from(range.getClientRects()).filter(
      (r) => r.width > 0 && r.height > 0
    );

    // Accurate position at the end of the last non-empty client rect (multiline support)
    const targetRect = rects.length > 0 ? rects[rects.length - 1] : range.getBoundingClientRect();

    let topPos = window.scrollY + targetRect.top - 28;
    if (topPos < window.scrollY) {
      topPos = window.scrollY + targetRect.bottom + 4;
    }

    const position = {
      top: topPos,
      left: window.scrollX + targetRect.right + 6
    };

    transitionTo(State.SELECTED, { text, position });
  }, 10);
});

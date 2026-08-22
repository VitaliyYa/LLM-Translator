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
let translatorIcon = null;
let translationPopup = null;
const activeTimerIds = new Set();

console.log('LLM-Translator: Content script loaded');

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
 * Centralized cleanup of DOM elements, timers, and global document listeners.
 */
function cleanup() {
  clearTrackedTimers();

  if (translatorIcon) {
    translatorIcon.remove();
    translatorIcon = null;
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
 * Handles clicks outside translator UI elements to dismiss them.
 */
function handleDocumentClick(event) {
  if (
    (translatorIcon && translatorIcon.contains(event.target)) ||
    (translationPopup && translationPopup.contains(event.target))
  ) {
    return;
  }
  transitionTo(State.IDLE);
}

/**
 * Creates and mounts the translator trigger icon.
 */
function createTranslatorIcon(position) {
  if (translatorIcon) {
    translatorIcon.remove();
    translatorIcon = null;
  }

  translatorIcon = document.createElement('div');
  translatorIcon.id = 'translator-icon';
  translatorIcon.style.position = 'absolute';
  translatorIcon.style.top = `${position.top}px`;
  translatorIcon.style.left = `${position.left}px`;
  translatorIcon.style.width = '32px';
  translatorIcon.style.height = '32px';
  translatorIcon.style.backgroundImage = `url(${chrome.runtime.getURL('icons/icon48.png')})`;
  translatorIcon.style.backgroundSize = 'contain';
  translatorIcon.style.backgroundRepeat = 'no-repeat';
  translatorIcon.style.backgroundPosition = 'center center';
  translatorIcon.style.cursor = 'pointer';
  translatorIcon.style.zIndex = '9999';

  // Prevent mousedown from dropping text selection
  translatorIcon.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  // Handle icon click - trigger translation
  translatorIcon.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (currentState === State.SELECTED && savedSelectionText) {
      transitionTo(State.LOADING);
    }
  });

  document.body.appendChild(translatorIcon);
}

/**
 * Displays the translation popup with result or error message, clamped to viewport.
 */
function showTranslationPopup(messageText, isError = false) {
  if (translationPopup) {
    translationPopup.remove();
    translationPopup = null;
  }

  translationPopup = document.createElement('div');
  translationPopup.id = 'translation-popup';
  translationPopup.style.position = 'absolute';
  translationPopup.style.padding = '12px';
  translationPopup.style.backgroundColor = '#ffffff';
  translationPopup.style.border = '1px solid #cccccc';
  translationPopup.style.borderRadius = '6px';
  translationPopup.style.boxShadow = '0 3px 10px rgba(0,0,0,0.3)';
  translationPopup.style.zIndex = '999999';
  translationPopup.style.maxWidth = '400px';
  translationPopup.style.fontSize = '14px';
  translationPopup.style.lineHeight = '1.5';
  translationPopup.style.color = isError ? '#cc0000' : '#333333';
  translationPopup.style.textAlign = 'left';
  translationPopup.style.fontFamily = 'Arial, sans-serif';
  translationPopup.textContent = messageText;

  translationPopup.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });

  // Temporarily add to DOM to measure dimensions
  translationPopup.style.visibility = 'hidden';
  translationPopup.style.top = '-9999px';
  translationPopup.style.left = '-9999px';
  document.body.appendChild(translationPopup);

  const popupWidth = translationPopup.offsetWidth;
  const popupHeight = translationPopup.offsetHeight;

  const anchorTop = savedPosition ? savedPosition.top : window.scrollY + 50;
  const anchorLeft = savedPosition ? savedPosition.left : window.scrollX + 50;
  const anchorHeight = 32;

  let desiredTop = anchorTop + anchorHeight + 2;
  let desiredLeft = anchorLeft;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const buffer = 10;

  // Viewport horizontal clamping
  if (desiredLeft + popupWidth > scrollX + viewportWidth - buffer) {
    desiredLeft = scrollX + viewportWidth - popupWidth - buffer;
  }
  if (desiredLeft < scrollX + buffer) {
    desiredLeft = scrollX + buffer;
  }

  // Viewport vertical clamping
  if (desiredTop + popupHeight > scrollY + viewportHeight - buffer) {
    const topAbove = anchorTop - popupHeight - 2;
    if (topAbove < scrollY + buffer) {
      desiredTop = scrollY + viewportHeight - popupHeight - buffer;
    } else {
      desiredTop = topAbove;
    }
  }
  if (desiredTop < scrollY + buffer) {
    desiredTop = scrollY + buffer;
  }

  translationPopup.style.top = `${desiredTop}px`;
  translationPopup.style.left = `${desiredLeft}px`;
  translationPopup.style.visibility = 'visible';
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
        createTranslatorIcon(savedPosition);
        document.addEventListener('keydown', handleKeyDown);
        setTrackedTimeout(() => {
          document.addEventListener('click', handleDocumentClick);
        }, 0);
      }
      break;

    case State.LOADING:
      currentState = State.LOADING;
      if (translatorIcon) {
        translatorIcon.remove();
        translatorIcon = null;
      }

      const requestId = generateRequestId();
      currentRequestId = requestId;

      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('click', handleDocumentClick);

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
      showTranslationPopup(payload.translation || '');
      document.addEventListener('keydown', handleKeyDown);
      setTrackedTimeout(() => {
        document.addEventListener('click', handleDocumentClick);
      }, 0);
      break;

    case State.ERROR:
      currentState = State.ERROR;
      const errorMessage = payload.error?.message || 'Translation failed.';
      showTranslationPopup(errorMessage, true);
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
  // Ignore clicks on existing extension UI elements
  if (
    (translatorIcon && translatorIcon.contains(e.target)) ||
    (translationPopup && translationPopup.contains(e.target))
  ) {
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

    let topPos = window.scrollY + targetRect.top - 24;
    if (topPos < window.scrollY) {
      topPos = window.scrollY + targetRect.bottom + 4;
    }

    const position = {
      top: topPos,
      left: window.scrollX + targetRect.right + 5
    };

    transitionTo(State.SELECTED, { text, position });
  }, 10);
});

// Variables for icon and popup
let translatorIcon = null;
let translationPopup = null;
let preventIconRemoval = false; // flag to prevent icon removal on click

console.log('LLM-Translator: Content script loaded');

function removeTranslatorElements() {
  // Don't remove elements if preventIconRemoval flag is set
  if (preventIconRemoval) {
    console.log('LLM-Translator: Element removal canceled by flag');
    return;
  }
  
  console.log('LLM-Translator: Removing interface elements');
  if (translatorIcon) {
    translatorIcon.remove();
    translatorIcon = null;
  }
  if (translationPopup) {
    translationPopup.remove();
    translationPopup = null;
  }
}

// Creating an icon next to the selected text
function createTranslatorIcon(rect) {
  console.log('LLM-Translator: Creating translation icon');
  removeTranslatorElements();
  translatorIcon = document.createElement('div');
  translatorIcon.id = 'translator-icon';
  translatorIcon.style.position = 'absolute';
  translatorIcon.style.top = (window.scrollY + rect.top - 24) + 'px';
  translatorIcon.style.left = (window.scrollX + rect.right + 5) + 'px';
  translatorIcon.style.width = '32px';
  translatorIcon.style.height = '32px';
  
  // Use icon from extension directory
  translatorIcon.style.backgroundImage = `url(${chrome.runtime.getURL('icons/icon48.png')})`;
  translatorIcon.style.backgroundSize = 'contain';
  translatorIcon.style.backgroundRepeat = 'no-repeat';
  translatorIcon.style.backgroundPosition = 'center center';
  translatorIcon.style.cursor = 'pointer';
  translatorIcon.style.zIndex = '9999';
  
  document.body.appendChild(translatorIcon);
  console.log('LLM-Translator: Icon added to DOM');
  
  // mousedown handler on icon to prevent selection loss
  translatorIcon.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('LLM-Translator: mousedown intercepted on icon');
    preventIconRemoval = true; // Set flag
    return false;
  });
  
  // Click handler on icon
  translatorIcon.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('LLM-Translator: Click on icon');
    
    const selection = window.getSelection().toString().trim();
    if (selection) {
      console.log(`LLM-Translator: Sending text for translation: "${selection.substring(0, 50)}${selection.length > 50 ? '...' : ''}"`);
      chrome.runtime.sendMessage({ type: 'translateText', text: selection }, (response) => {
        preventIconRemoval = false; // Reset flag after response
        console.log('LLM-Translator: Response received from background script:', response);
        showTranslationPopup(response);
      });
    }
    return false;
  });
}

// Display popup with translation result
function showTranslationPopup(response) {
  console.log('LLM-Translator: Displaying translation result', response);
  if (translationPopup) translationPopup.remove();
  
  translationPopup = document.createElement('div');
  translationPopup.id = 'translation-popup';
  translationPopup.style.position = 'absolute';
  translationPopup.style.top = (translatorIcon.offsetTop + 30) + 'px';
  translationPopup.style.left = translatorIcon.offsetLeft + 'px';
  translationPopup.style.padding = '12px';
  translationPopup.style.backgroundColor = '#ffffff';
  translationPopup.style.border = '1px solid #cccccc';
  translationPopup.style.borderRadius = '6px';
  translationPopup.style.boxShadow = '0 3px 10px rgba(0,0,0,0.3)';
  translationPopup.style.zIndex = '999999';
  translationPopup.style.maxWidth = '400px';
  translationPopup.style.fontSize = '14px';
  translationPopup.style.lineHeight = '1.5';
  translationPopup.style.color = '#333333';
  translationPopup.style.textAlign = 'left';
  translationPopup.style.fontFamily = 'Arial, sans-serif';
  
  if (response.error) {
    console.error('LLM-Translator: Translation error:', response.error);
    translationPopup.textContent = response.error;
    translationPopup.style.color = '#cc0000';
  } else if (response.translation) {
    console.log('LLM-Translator: Translation successfully received');
    translationPopup.textContent = response.translation;
  } else {
    console.error('LLM-Translator: Unknown response format');
    translationPopup.textContent = 'Unknown error.';
    translationPopup.style.color = '#cc0000';
  }
  
  document.body.appendChild(translationPopup);
  console.log('LLM-Translator: Popup added to DOM');
  
  // Close popup when clicking outside
  setTimeout(() => {
    document.addEventListener('click', handleClickOutside);
  }, 0);
}

// Handler for clicks outside the popup
function handleClickOutside(event) {
  if (translationPopup && !translationPopup.contains(event.target) && event.target !== translatorIcon) {
    console.log('LLM-Translator: Click outside popup, closing');
    preventIconRemoval = false; // Reset flag
    removeTranslatorElements();
    document.removeEventListener('click', handleClickOutside);
  }
}

// Tracking text selection
document.addEventListener('mouseup', (e) => {
  // If click was on icon, ignore
  if (translatorIcon && translatorIcon.contains(e.target)) {
    console.log('LLM-Translator: mouseup on icon, ignoring');
    return;
  }
  
  setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText) {
      console.log(`LLM-Translator: Text selected: "${selectedText.substring(0, 50)}${selectedText.length > 50 ? '...' : ''}"`);
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      createTranslatorIcon(rect);
    } else {
      if (translatorIcon && !preventIconRemoval) {
        console.log('LLM-Translator: Selection removed');
        removeTranslatorElements();
      }
    }
  }, 10);
});

// Close window on Esc key press
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    console.log('LLM-Translator: Esc key pressed, closing');
    preventIconRemoval = false; // Reset flag
    removeTranslatorElements();
  }
});

// Remove elements when selection is cleared
document.addEventListener('selectionchange', () => {
  if (preventIconRemoval) {
    console.log('LLM-Translator: selectionchange ignored due to flag');
    return;
  }
  
  const selection = window.getSelection().toString().trim();
  if (!selection) {
    if (translatorIcon) {
      console.log('LLM-Translator: Selection cleared');
      // Small delay to allow click event to trigger
      setTimeout(() => {
        if (!preventIconRemoval) {
          removeTranslatorElements();
        }
      }, 100);
    }
  }
});

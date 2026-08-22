# Implementation Plan: LLM Translator

## 1. Goals & Decisions

The project remains a lightweight educational browser extension for personal use. The primary user flow: a user selects text on a web page, clicks the floating action button, and receives an instant translation via the Google Gemini API with an API key from Google AI Studio.

Architectural Constraints:

- Exclusively supports the Google Gemini API.
- Primary development platform: Chrome/Chromium with Manifest V3.
- Firefox compatibility is verified after stabilizing each major stage.
- Pure vanilla HTML, CSS, and JavaScript without heavy frameworks, TypeScript, or complex bundlers.
- Automated tests use Node.js built-in `node:test` for pure logic; manual browser validation remains the primary UI verification method.
- Text selection inside `<input>`, `<textarea>`, PDF viewers, and closed Shadow DOM roots is out of scope for initial phases.
- Publishing to extension stores is not an active goal at this time.

## 2. Target Architecture

Code is cleanly organized by responsibility without unnecessary abstractions, leveraging native ES modules:

- `background.js` — Service Worker (`"type": "module"` in manifest), handles message routing, storage access, and invokes translation logic.
- `gemini.js` — Pure ES module for request formatting, response parsing, safety block inspection, and error normalization (zero dependencies on `chrome.*` APIs).
- `content.js` — Selection interception, UI finite state machine, and Shadow DOM mounting.
- `content.css` — Encapsulated styles for the button and translation popup within the Shadow DOM.
- `options.html`, `options.js`, and `options.css` — Extension options page with key masking and validation.
- `manifest.json` and `manifest.firefox.json` — Minimal required browser permissions and entry points.
- `tests/` — Automated `node:test` suites for request building, response parsing, and settings validation.

Messaging protocol between `content.js` and `background.js`:

```js
// Translation request
{ type: 'translation.request', requestId, text }

// Successful response
{ requestId, ok: true, translation }

// Error response
{ requestId, ok: false, error: { code, message } }
```

Storage schema (`chrome.storage.local`):

```js
{
  apiKey: string,
  targetLanguage: string,
  model: string
}
```

The API endpoint is hardcoded internally as `https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent`.

## 3. Implementation Stages

### Stage 0. Baseline Integration (Completed)

- [x] Align base request structure with Google AI Studio: model `gemini-3.5-flash-lite`, method `streamGenerateContent`, role `user`, and minimal thinking level.
- [x] Separate system instructions and user text; enable structured output with `{ translation: string }` schema.
- [x] Format URL from model name and correctly aggregate streaming chunks.
- [x] Add Chrome host permission for `https://generativelanguage.googleapis.com/*` required for cross-origin service worker requests.
- [x] Exclude `googleSearch` tool (unnecessary for pure translation).
- [x] Load unpacked extension into Chrome.
- [x] Manually verify settings storage, selection button appearance, and translation delivery in Chrome.
- [x] Verify popup dismissal via Escape key.
- [x] Perform codebase audit and align implementation roadmap with actual state.

Completion criterion: Baseline translation workflow functions in Chrome; roadmap reflects actual codebase state.

---

### Stage 1. Secure API Key, Migrate to `chrome.storage.local` & Clean Manifest (Completed)

- [x] Pass Gemini API key exclusively via the `x-goog-api-key` HTTP header; remove key from URL query parameters.
- [x] Remove all sensitive data logging to console (user input text, response payloads, raw API `errorText`).
- [x] Remove insecure URL query parameter parsing (`window.location.search`) on the options page.
- [x] Migrate settings storage from `chrome.storage.sync` to `chrome.storage.local`.
- [x] Implement automatic first-run migration: transfer `baseLanguage` and `apiKey` from `storage.sync`, rename to `targetLanguage`, save to `storage.local`, and purge old sync entry.
- [x] Synchronously update storage reading/writing in `options.js` and `background.js` to match the `{ apiKey, targetLanguage, model }` schema.
- [x] Remove unused permissions `activeTab` and `scripting` from `manifest.json`.
- [x] Remove dead `input[type="url"]` selector from `options.html`.

Browser verification:

1. Existing settings automatically migrate from sync to local storage without user intervention.
2. API keys are absent from outgoing URL query strings, console logs, and UI error messages.
3. Settings persist across browser restarts and extension reloads in `chrome.storage.local`.
4. An invalid API key yields a clear error message without leaking raw API payload to the page.

---

### Stage 2. Extract `gemini.js` Module & Introduce Unit Tests (Completed)

- [x] Add `"type": "module"` to the `background` block in `manifest.json` for native ESM Service Worker support.
- [x] Extract all Gemini integration logic into a standalone `gemini.js` module exporting pure functions (zero `chrome.*` dependencies).
- [x] Maintain `systemInstruction`, structured output schema (`responseSchema`), and chunk concatenation.
- [x] Add granular inspection of HTTP status, `promptFeedback.blockReason`, and `candidates[0].finishReason` (handling `SAFETY`, `RECITATION`, `MAX_TOKENS`).
- [x] Implement 30-second request timeout using `AbortController`.
- [x] Enforce 10,000 character limit on translation input before making network calls.
- [x] Normalize all error states into typed codes: `SETTINGS_MISSING`, `TEXT_TOO_LONG`, `TIMEOUT`, `AUTH`, `RATE_LIMIT`, `BLOCKED`, `NETWORK`, `BAD_RESPONSE`.
- [x] Migrate background message handling to `{ type: 'translation.request', requestId, text }`, preserving backwards-compatibility during migration.
- [x] Create automated test suite `tests/gemini.test.js` using Node.js built-in `node:test` and `node:assert` for request building, response parsing, and error normalization.

Verification:

1. Automated tests `node --test` pass for valid payloads, chunked streams, malformed JSON, and safety blocks.
2. In browser: plain text, multiline text, quotes, code symbols, and prompt injection attempts translate reliably.
3. Empty responses, offline states, invalid keys, and text limit violations return normalized error codes.
4. Slow/hung requests cleanly abort after 30 seconds.

---

### Stage 3. Fix Content Script State Machine & Selection Lifecycle (Completed)

- [x] Capture selection text and bounding coordinates strictly at the moment of the `mouseup` event (never read `window.getSelection()` inside the click handler).
- [x] Implement a deterministic Finite State Machine: `IDLE`, `SELECTED`, `LOADING`, `SUCCESS`, `ERROR`.
- [x] Completely remove the `preventIconRemoval` flag and resolve all event race conditions.
- [x] Generate a unique `requestId` per request; ignore stale responses from rapid sequential selections.
- [x] Add safe handling of `chrome.runtime.lastError` to prevent unhandled exceptions upon extension updates.
- [x] Implement centralized `cleanup()` method: remove global document listeners (outside clicks, Escape) and clear pending `setTimeout` timers.
- [x] Use the last non-empty client rectangle (`range.getClientRects()`) to accurately position the button at the end of multiline selections.

Browser verification:

1. Rapid sequential selections display only the translation for the most recently selected text.
2. Clicking the translate button reliably dispatches saved text even if DOM focus/selection was lost.
3. Pressing Escape, clicking outside, or clearing selection cleans up all UI and removes document event listeners.
4. Reloading the extension in `chrome://extensions` while a tab is open does not trigger uncaught runtime crashes on the page.

---

### Stage 4. Encapsulate Translation UI (Shadow DOM, a11y, Themes) (Completed)

- [x] Mount all injected extension UI within an open Shadow DOM (`attachShadow({ mode: 'open' })`) to isolate styles from host page CSS.
- [x] Encapsulate UI styling in `content.css` and inject it inside the Shadow Root.
- [x] Replace the clickable `div` with an accessible `button` element featuring `aria-label`, visible focus indicator, and `Enter`/`Space` activation.
- [x] Display a loading indicator (spinner) immediately upon clicking translate.
- [x] Add action buttons: "Copy" (with temporary "Copied!" confirmation toast), "Retry", and "Close".
- [x] Preserve whitespace and line breaks with `white-space: pre-wrap`.
- [x] Constrain dimensions (`maxWidth`, `maxHeight`), enable internal scrolling (`overflow-y: auto`), and clamp positioning within the viewport.
- [x] Provide light and dark theme styling responding to `prefers-color-scheme`.
- [x] Suppress internal system URLs and raw API errors from user display.

Browser verification:

1. UI renders correctly on websites with aggressive global CSS resets (Wikipedia, GitHub, MDN).
2. Icon and popup never overflow beyond any of the four viewport edges across zoom levels and scroll positions.
3. Complete translation flow is accessible via keyboard (`Tab`, `Enter`, `Space`, `Escape`).
4. Long multiline texts scroll smoothly; clipboard copying functions reliably.

---

### Stage 5. Polish Extension Options Page

- Standardize options form fields: Target Language (`targetLanguage`), Gemini Model (`model`), and API Key (`apiKey`).
- Mask the API key field (`type="password"`) and provide a show/hide password toggle.
- Provide clear description and default placeholder for model selection (`gemini-3.5-flash-lite`).
- Implement form validation for required fields and valid model name characters.
- Add a "Test Connection" button that sends a lightweight verification ping via `background.js` and `gemini.js`.
- Add an `aria-live="polite"` region for accessible status and error announcements.
- Include direct link to Google AI Studio with instructions for obtaining a free API key.
- Style options page with automatic light and dark theme support.

Browser verification:

1. Empty or malformed inputs are blocked by client-side validation.
2. The API key is masked by default and not exposed in HTML source or logs.
3. Connection test distinguishes between success, invalid key, unavailable model, and network failure.
4. Screen readers announce status updates via `aria-live`.

---

### Stage 6. Firefox Compatibility, CI/CD Automation & Documentation

- Verify WebExtension API compatibility and behavior in current Firefox versions.
- Standardize Firefox manifest (`manifest.firefox.json`) with aligned permissions (MV3 where supported or scoped MV2).
- Upgrade GitHub Actions CI runner (`.github/workflows/build-extensions.yml`) to Node.js 20 LTS.
- Add CI workflow steps for JavaScript syntax checking (`node --check`) and automated unit testing (`node --test`).
- Update packaging scripts ([prepare_firefox.bat](prepare_firefox.bat) and CI workflow) to include all newly modularized files (`gemini.js`, `content.css`, `options.css`).
- Add options validation tests in `tests/options.test.js`.
- Update [README.md](README.md) with comprehensive installation, setup, model configuration, and troubleshooting instructions.

Completion criterion: Translation flow functions identically in Chrome and Firefox; automated tests and builds pass in GitHub Actions; documentation is complete.

---

## 4. Commit Conventions & Development Discipline

Each stage is developed on a dedicated branch with small, focused commits:

1. Logic and code changes without unrelated refactoring.
2. Automated tests for pure logic (starting from Stage 2).
3. Manual verification in real browser with recorded results.
4. Documentation and manifest updates.
5. Cross-browser validation in Firefox for platform-spanning changes.

Do not begin the next stage until the current stage has been fully verified in the browser and any regressions are resolved.

## 5. Final Project Criteria

- Extension translates text exclusively through the Google Gemini API.
- API key is stored securely in `chrome.storage.local`, never synced, never passed in URLs, and never logged.
- Network errors, timeouts, and API safety blocks produce user-friendly error codes without uncaught content script exceptions.
- Text selection, rapid clicking, and window dismissal behave deterministically without race conditions or memory leaks.
- UI is encapsulated in Shadow DOM, supports keyboard navigation, and automatically adapts to dark mode.
- Core flow verified and fully operational in Chrome and Firefox.
- Pure logic covered with automated `node:test` suites integrated into CI.
- README allows any developer or user to install and configure the extension without reading source code.

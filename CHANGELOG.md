# Changelog (CHANGELOG.md)

All notable changes to the **LLM-Translator** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.8.0] - 2026-08-23

### Added (Stage 7: OpenAI-Compatible Custom Provider Support)
- Added support for custom OpenAI-compatible API providers (e.g. OpenRouter, local Ollama, LM Studio, vLLM, OpenAI).
- Added provider switcher to options page with dynamic display of provider-specific configuration panels.
- Added independent storage in `chrome.storage.local` for Gemini and Custom provider credentials, preserving keys across provider switches.
- Added pure ES module `openai.js` for OpenAI-compatible completions with response parsing, markdown stripping, and error normalization.
- Added automated unit test suite `tests/openai.test.js` and updated options validation tests in `tests/options.test.js`.
- Expanded `host_permissions` in Chrome and Firefox manifests to `["<all_urls>"]` to enable arbitrary user API endpoint access.

---

## [0.7.0] - 2026-08-22

### Added (Stage 6: Firefox Compatibility, CI/CD Automation & Documentation)
- Upgraded Mozilla Firefox extension support to Manifest V3 (`manifest_version: 3`) with native ES module background event-page architecture.
- Added GitHub Actions continuous integration pipeline running on Node.js 24 LTS with automated syntax checks, unit tests, and cross-browser zip artifact packaging (`chrome-extension.zip`, `firefox-extension.zip`).
- Standardized extension metadata descriptions in English across all platform manifests.
- Added comprehensive developer and user documentation in `README.md`.

---

## [0.6.0] - 2026-08-22

### Added (Stage 5: Polish Extension Options Page)
- Redesigned options page with a responsive card layout and light/dark theme support matching the browser color scheme (`options.css`).
- Masked API key field with `type="password"` by default and added an accessible show/hide password toggle button with ARIA attributes.
- Added client-side form validation for required fields (`targetLanguage`, `apiKey`) and valid Gemini model name characters (`/^[a-zA-Z0-9._-]+$/`).
- Added "Test Connection" button providing an instant verification ping to the Gemini API via background service worker.
- Added granular error feedback distinguishing between authentication failure (invalid key), unavailable/missing model (404), network disconnects, and rate limits.
- Added accessible status notification region with `role="status"` and `aria-live="polite"`.
- Added guide card with direct link to Google AI Studio for acquiring an API key.

---

## [0.5.0] - 2026-08-22

### Added (Stage 4: Encapsulate Translation UI)
- Encapsulated injected content script UI inside an open Shadow DOM (`attachShadow({ mode: 'open' })`) to prevent styling conflicts with host page stylesheets.
- Added `content.css` containing isolated styling, CSS variables, and light/dark theme support responding to `prefers-color-scheme`.
- Replaced trigger `div` with an accessible semantic `<button>` element with `aria-label`, visible `:focus-visible` ring, and keyboard trigger (`Enter`/`Space`).
- Implemented immediate loading spinner state on translation trigger.
- Added action buttons to translation popup: "Copy" (with temporary "Copied!" feedback and clipboard fallback), "Retry" (to re-dispatch failed requests without re-selecting), and "Close".
- Preserved text whitespace and formatting with `white-space: pre-wrap` and added internal vertical scrollbar for long translations.
- Implemented multi-directional viewport boundary clamping algorithm across all four viewport edges with scroll offset support.
- Sanitized user-facing error messages to prevent leakage of internal system URLs or raw API payloads.

---

## [0.4.0] - 2026-08-22

### Added (Stage 3: Content Script Lifecycle & State Machine)
- Implemented deterministic Finite State Machine (`IDLE`, `SELECTED`, `LOADING`, `SUCCESS`, `ERROR`) in `content.js`.
- Added `range.getClientRects()` positioning to accurately place the translate trigger at the end of multiline selections.
- Added asynchronous request correlation using unique `requestId` to prevent stale responses from overwriting newer selections.
- Added safe `chrome.runtime.lastError` handling to prevent uncaught exceptions when the extension context is reloaded.
- Implemented centralized `cleanup()` routine managing DOM elements, active timers, and global listeners.

### Fixed
- Eliminated `preventIconRemoval` flag and selection race conditions.
- Fixed selection loss on button click by capturing selected text on `mouseup` rather than in the click handler.

---

## [0.3.0] - 2026-08-22

### Added (Stage 2: Gemini Module & Automated Tests)
- Modularized Gemini API logic into an isolated pure ES module (`gemini.js`) with native ESM support in Service Worker (`manifest.json`).
- Implemented 30-second request timeout via `AbortController` and 10,000 character limit on translation input.
- Added structured API response inspection for safety blocks (`promptFeedback.blockReason`, `finishReason`).
- Added typed error normalization (`SETTINGS_MISSING`, `TEXT_TOO_LONG`, `TIMEOUT`, `AUTH`, `RATE_LIMIT`, `BLOCKED`, `NETWORK`, `BAD_RESPONSE`).
- Migrated background message handling to `{ type: 'translation.request', requestId, text }` with backward compatibility for existing content scripts.
- Added comprehensive unit test suite (`tests/gemini.test.js`) executed via Node.js built-in `node:test`.

---

## [0.2.0] - 2026-08-22

### Security (Stage 1: Secure API Key & Storage Migration)
- Switched Gemini API authentication to the `x-goog-api-key` HTTP header, removing API key from URL query parameters.
- Migrated settings storage from `chrome.storage.sync` to `chrome.storage.local` with automatic first-run backward migration.
- Sanitized console logs across background, content, and options scripts to prevent leakage of user text, API keys, and error payloads.
- Removed insecure URL query parameter parsing (`window.location.search`) on the options page.

### Changed
- Standardized storage schema to `{ apiKey, targetLanguage, model }`.
- Cleaned unused `activeTab` and `scripting` permissions from `manifest.json`.
- Removed obsolete `input[type="url"]` style selector from `options.html`.

---

## [0.1.0-baseline] - 2026-08-22

### Added (Stage 0: Baseline Integration)
- Standardized request to Google Gemini API using `streamGenerateContent` with `gemini-3.5-flash-lite`.
- Configured minimal reasoning mode (`thinkingLevel: 'MINIMAL'`).
- Separated `systemInstruction` from `contents` with user role.
- Structured JSON output with `responseSchema` for `{ translation: string }`.
- Streaming chunk aggregation in background service worker.
- Declared `host_permissions` for `https://generativelanguage.googleapis.com/*` in `manifest.json`.
- Basic floating translate icon on text selection.
- Basic translation popup with relative positioning.
- Dismiss popup on `Escape` key press.

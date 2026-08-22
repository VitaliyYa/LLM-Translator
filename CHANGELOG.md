# Changelog (CHANGELOG.md)

All notable changes to the **LLM-Translator** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased / In Development]

### Planned (Stage 3): Content Script Lifecycle & State Machine
- Capture text selection and bounding rects strictly on `mouseup` using `range.getClientRects()`.
- Implement Finite State Machine (`IDLE`, `SELECTED`, `LOADING`, `SUCCESS`, `ERROR`).
- Eliminate `preventIconRemoval` flag and state race conditions.
- Introduce `requestId` to prevent stale response overwrites.
- Safely handle `chrome.runtime.lastError` and clean up all event listeners and timers on reset.

### Planned (Stage 4): Encapsulated Translation UI
- Encapsulate UI and styles within an open Shadow DOM.
- Replace clickable `div` with accessible `button` (`aria-label`, visible focus, Enter/Space support).
- Display loading spinner immediately upon clicking translate.
- Add "Copy" (with feedback toast), "Retry", and "Close" action buttons.
- Preserve formatting with `white-space: pre-wrap`, internal scrolling, and viewport-boundary clamping.
- Support light and dark color schemes via `prefers-color-scheme`.

### Planned (Stage 5): Options Page Polish
- Mask API key field (`type="password"`) with a show/hide toggle.
- Add "Test Connection" button with a lightweight verification ping.
- Add accessible status announcements via `aria-live="polite"`.
- Provide direct link and guide for Google AI Studio API key generation.

### Planned (Stage 6): Firefox Compatibility & CI/CD
- Validate WebExtension APIs in modern Firefox.
- Upgrade GitHub Actions runner to Node.js 20 LTS.
- Add automated syntax checking (`node --check`) and test running (`node --test`) in CI.
- Update packaging scripts for distribution.

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

# AI Agent Guidelines (AGENTS.md)

This document describes the rules, architecture, technology stack, and conventions for AI assistants and human developers working on the **LLM-Translator** repository.

### Mandatory Workflow Protocol
#### At the beginning of EVERY session:
Read AGENTS.md (this file), IMPLEMENTATION_PLAN.md, and CHANGELOG.md.
If the task involves testing — read TESTING.md.

#### Before considering a task complete:
- Update IMPLEMENTATION_PLAN.md — check off completed steps and record the actual state (not what was planned, but what was actually done).
- Add an entry to CHANGELOG.md following the Keep a Changelog format.
- If functionality affecting the test checklist was changed — update TESTING.md.
- Do not consider a task complete until the documentation is synchronized with the code.
- If the plan (IMPLEMENTATION_PLAN.md) diverges from the actual state of the codebase — explicitly report this before continuing, rather than silently adjusting one to match the other.
---

## 1. Project Overview & Architectural Principles

**LLM-Translator** is a browser extension designed to translate selected text on web pages using the Google Gemini API (`streamGenerateContent`).

### Key Architectural Constraints
- **Language Standard:** All project files, documentation (`*.md`), code, and code comments **must be written in English**.
- **Technology Stack:** Vanilla JavaScript (ES2022+), HTML5, CSS3. **No heavy frameworks (React/Vue), TypeScript, or complex bundlers (Webpack/Vite)**.
- **Modularity:** Native ES modules (`import`/`export`). In `manifest.json`, the background service worker is declared with `"type": "module"`.
- **UI Isolation:** The content script interface (`content.js`) must be encapsulated within an open **Shadow DOM** (`attachShadow({ mode: 'open' })`) to prevent host page CSS conflicts.
- **Data Security & Privacy:**
  - The API key is stored exclusively in `chrome.storage.local` (never in `chrome.storage.sync`).
  - The API key is passed to Gemini API **only** via the `x-goog-api-key` HTTP header, never in URL query parameters.
  - Never log translated text, API keys, or raw error response bodies (`errorText`) to the console.
- **Testing:** Unit tests for pure logic are written using Node.js built-in `node:test` and `node:assert` modules (no Jest/Mocha).

---

## 2. Repository Structure

```
├── manifest.json            # Manifest for Chrome/Chromium (Manifest V3)
├── manifest.firefox.json    # Manifest for Mozilla Firefox
├── background.js            # Service Worker: message routing and storage access
├── gemini.js                # Pure Gemini API request & response parsing module (no chrome.* API)
├── content.js               # Content Script: text selection interception, UI state machine
├── content.css              # Encapsulated Shadow DOM styles
├── options.html             # Extension settings page
├── options.js               # Extension settings logic
├── options.css              # Extension settings styles
├── prepare_firefox.bat      # Firefox build script (Windows)
├── .github/workflows/       # CI/CD automation (Node 20, syntax check and test runner)
├── tests/                   # Automated tests (node:test)
│   ├── gemini.test.js       # Unit tests for Gemini requests, responses, and error handling
│   └── options.test.js      # Unit tests for settings field validation
├── AGENTS.md                # This guide for AI agents
├── DECISIONS.md             # Architecture Decision Records (ADRs)
├── CHANGELOG.md             # Project changelog
├── IMPLEMENTATION_PLAN.md   # Step-by-step roadmap and stage criteria
├── TESTING.md               # Manual and automated testing checklist
└── README.md                # User and developer documentation
```

---

## 3. Protocols & Data Schemas

### Messaging Protocol (`content.js` <-> `background.js`)

**Translation Request:**
```js
{
  type: 'translation.request',
  requestId: 'req_1724320000000_abc123',
  text: 'Text to translate'
}
```

**Successful Response:**
```js
{
  requestId: 'req_1724320000000_abc123',
  ok: true,
  translation: 'Translated text'
}
```

**Error Response:**
```js
{
  requestId: 'req_1724320000000_abc123',
  ok: false,
  error: {
    code: 'AUTH' | 'RATE_LIMIT' | 'TIMEOUT' | 'TEXT_TOO_LONG' | 'SETTINGS_MISSING' | 'BLOCKED' | 'NETWORK' | 'BAD_RESPONSE',
    message: 'User-friendly error description'
  }
}
```

### Storage Schema (`chrome.storage.local`)
```js
{
  apiKey: string,          // Google AI Studio API Key
  targetLanguage: string,  // Target translation language (e.g. "Russian")
  model: string            // Gemini model name (default: "gemini-3.5-flash-lite")
}
```

---

## 4. Coding Rules for AI Agents

### Rule 1: Purity of `gemini.js`
The `gemini.js` module must not invoke any `chrome.*` APIs. It exports pure functions:
- `buildGeminiRequestBody(text, targetLanguage)`
- `parseGeminiResponse(data)`
- `normalizeGeminiError(error, responseStatus, responseBody)`
- `translateWithGemini({ apiKey, model, targetLanguage, text, signal })`
This guarantees 100% testability via `node:test` without browser environment mocks.

### Rule 2: State Lifecycle in `content.js`
- State is managed via a Finite State Machine (FSM):
  `IDLE` -> `SELECTED` -> `LOADING` -> `SUCCESS` | `ERROR`.
- Selected text and client coordinates are captured **strictly during the `mouseup` event** using `range.getClientRects()`.
- **Never** call `window.getSelection()` inside the click handler of the translation icon (selection may already be lost).
- **No global flags** such as `preventIconRemoval`. All UI teardown and state resets must be executed through a centralized `cleanup()` method.
- Always generate a unique `requestId` and verify it in the response to discard stale asynchronous replies.
- Handle `chrome.runtime.lastError` when sending messages to avoid unhandled page exceptions upon extension reload.

### Rule 3: Accessibility (a11y) & UI Isolation
- All interactive UI elements (`button`) must include an `aria-label`, visible focus indicators, and keyboard activation (`Enter`, `Space`, `Escape`).
- Status alerts in `options.html` must utilize `aria-live="polite"`.
- Popup positioning must be clamped within the viewport across all 4 edges with scroll offset calculations (`window.innerWidth`, `window.innerHeight`, `window.scrollX`, `window.scrollY`).

### Rule 4: Git Workflow & Implementation Discipline
- **Always** work on an isolated stage branch (e.g. `stage-1-security-storage`).
- Execute stages strictly sequentially according to [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).
- Do not perform extraneous or cosmetic refactorings outside the scope of the active stage.
- When creating new files (e.g., `gemini.js`, `content.css`, `options.css`), **always** update build scripts in `prepare_firefox.bat` and `.github/workflows/build-extensions.yml`.

---

## 5. Verification Commands

Before completing any stage, verify:
```bash
# 1. Syntax check
node --check background.js
node --check content.js
node --check gemini.js
node --check options.js

# 2. Run automated tests
node --test tests/

# 3. Check git status
git status
```

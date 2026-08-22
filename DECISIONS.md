# Architecture Decision Records (DECISIONS.md)

This document records the architectural decisions, context, rationale, and consequences for the **LLM-Translator** project.

---

## ADR-001: Sole Provider — Google Gemini API (`streamGenerateContent`)

* **Status:** Accepted (Stage 0)
* **Context:**
  The project originally planned to support arbitrary API endpoints and multiple LLM providers. This added substantial complexity (divergent request schemas, custom error parsers, per-provider model configs, and brittle regex-based JSON extraction).
* **Decision:**
  Standardize exclusively on the Google Gemini API (the `streamGenerateContent` method with the default model `gemini-3.5-flash-lite`).
* **Rationale:**
  1. Google AI Studio provides free, accessible tier limits for modern Gemini models.
  2. Native structured outputs (`responseMimeType: "application/json"` with `responseSchema`) guarantee strict JSON output matching `{ translation: string }` without regex heuristics.
  3. Configuring minimal reasoning (`thinkingLevel: 'MINIMAL'`) delivers high translation quality while maintaining low latency.
* **Consequences:**
  Simplifies settings, removes unnecessary provider abstraction layers, and guarantees predictable response parsing.

---

## ADR-002: Vanilla JavaScript without Frameworks or Bundlers

* **Status:** Accepted (Stage 0)
* **Context:**
  Modern browser extension setups commonly use Webpack/Vite, TypeScript, and UI libraries (React/Vue/Svelte).
* **Decision:**
  Rely purely on vanilla JavaScript (ES2022+), HTML5, and CSS3 without build/transpilation steps.
* **Rationale:**
  1. The project is a lightweight utility extension for personal and educational use.
  2. Eliminating build steps allows instantaneous reloading of unpacked extensions in Chrome and Firefox without waiting for bundler watchers.
  3. Avoids dependency bloat, `node_modules` vulnerabilities, and compiler drift.
* **Consequences:**
  Cross-browser compatibility and module loading must be managed carefully by hand.

---

## ADR-003: Pure ES Modules for API Integration (`gemini.js`)

* **Status:** Accepted (Stage 2)
* **Context:**
  All network logic was previously embedded directly inside the `chrome.runtime.onMessage` listener in `background.js`, preventing automated testing outside a browser runtime.
* **Decision:**
  Extract request building, chunk aggregation, safety block inspection, and error normalization into a dedicated `gemini.js` module using pure ES functions (independent of `chrome.*` APIs). In `manifest.json`, the background service worker is declared with `"type": "module"`.
* **Rationale:**
  1. Native ESM is supported in Manifest V3 Service Workers.
  2. The module can be directly imported and tested using Node.js built-in `node:test` (`tests/gemini.test.js`) without browser polyfills or mocks.
* **Consequences:**
  Clean separation of concerns: `gemini.js` handles API semantics; `background.js` handles messaging and storage.

---

## ADR-004: Shadow DOM Encapsulation for Content Script UI

* **Status:** Accepted (Stage 4)
* **Context:**
  UI elements (icon and translation popup) were injected directly into `document.body`. Host page stylesheets with aggressive CSS resets (e.g. `* { box-sizing: content-box !important; }` or custom `line-height`) distorted the extension UI.
* **Decision:**
  Mount all injected UI elements inside an open **Shadow DOM** (`attachShadow({ mode: 'open' })`) attached to a single host container.
* **Rationale:**
  1. Shadow DOM completely isolates extension styles (`content.css`) from host page rules.
  2. Prevents class and ID collisions with host DOM elements.
* **Consequences:**
  Guarantees consistent visual presentation across all target websites (Wikipedia, GitHub, MDN, news portals).

---

## ADR-005: Local Storage (`chrome.storage.local`) over Sync Storage (`chrome.storage.sync`)

* **Status:** Accepted (Stage 1)
* **Context:**
  Settings were previously saved in `chrome.storage.sync`.
* **Decision:**
  Migrate all persistent storage to `chrome.storage.local`.
* **Rationale:**
  1. `chrome.storage.sync` transmits data across Google account sync infrastructure unencrypted from Google's perspective. API keys should not synchronize across multiple devices unintentionally.
  2. `chrome.storage.local` provides higher quota limits and avoids strict write-rate limits (`MAX_WRITE_OPERATIONS_PER_MINUTE`).
* **Consequences:**
  An automatic migration routine is executed on first launch to move keys from `sync` to `local` and purge old sync entries.

---

## ADR-006: Header-Based Authentication (`x-goog-api-key`)

* **Status:** Accepted (Stage 1)
* **Context:**
  The Gemini API key was passed as a URL query parameter: `https://.../streamGenerateContent?key=AIzaSy...`.
* **Decision:**
  Transmit the API key strictly via the `x-goog-api-key` HTTP header.
* **Rationale:**
  1. URL query parameters are logged by proxies, stored in browser history, and risk accidental leakage in error traces.
  2. Header-based authentication is the secure standard recommended by Google Cloud APIs.
* **Consequences:**
  Prevents key leakage during debugging and in network diagnostics.

---

## ADR-007: Asynchronous Request Correlation with `requestId`

* **Status:** Accepted (Stage 3)
* **Context:**
  When users quickly select multiple pieces of text in succession, out-of-order responses from asynchronous fetch calls can overwrite newer translations with stale ones.
* **Decision:**
  Tag every translation request with a unique `requestId`. The content script will only render responses matching the active `requestId`.
* **Rationale:**
  Eliminates race conditions during rapid re-selection.
* **Consequences:**
  Ensures completely deterministic UI behavior.

---

## ADR-008: Manifest V3 for Mozilla Firefox and CI/CD Automation

* **Status:** Accepted (Stage 6)
* **Context:**
  Firefox previously used Manifest V2 with obsolete permission declarations (`activeTab`, `<all_urls>` in `permissions`, `browser_action`) and manual batch scripts (`prepare_firefox.bat`). Modern Firefox (109+, 115+ ESR) fully supports Manifest V3 with modular background scripts (`type: "module"`).
* **Decision:**
  1. Migrate `manifest.firefox.json` to Manifest V3 (`manifest_version: 3`), declaring `"background": { "scripts": ["background.js"], "type": "module" }`, scoped `permissions: ["storage"]`, and `host_permissions: ["https://generativelanguage.googleapis.com/*"]`.
  2. Standardize CI/CD automation in GitHub Actions with Node.js 24 LTS, `actions/checkout@v4`, `actions/setup-node@v4`, automated syntax verification (`node --check`), unit tests (`node --test 'tests/*.test.js'`), and artifact bundling (`options.css` included) for both Chrome and Firefox.
  3. Retire `prepare_firefox.bat` in favor of CI artifacts and direct source loading in developer mode.
* **Rationale:**
  1. Firefox Manifest V3 aligns permission models between Chrome and Firefox while allowing native ES module imports in background event pages without bundlers.
  2. CI automation on Node.js 24 LTS ensures consistent cross-platform validation and reproducible release zip packages.
* **Consequences:**
  Cross-browser codebase remains 100% vanilla JavaScript with zero build steps or bundlers, while package distribution is fully automated via CI.

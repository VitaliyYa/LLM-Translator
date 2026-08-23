# LLM Translator — Browser Extension for AI Translation

A lightweight, fast, and privacy-conscious browser extension for translating selected text on web pages using the Google Gemini API or custom OpenAI-compatible providers (such as OpenRouter).

Built with clean Vanilla JavaScript without heavy frameworks, transpilers, or build tools, with native Manifest V3 support for Chromium-based browsers (Google Chrome, Microsoft Edge, Brave, etc.) and Mozilla Firefox.

---

## ✨ Features

* 🚀 **Instant Selection Translation:** Select any text on a webpage and click the floating translate icon.
* 🤖 **Multi-Provider AI Support:**
  * **Google Gemini:** Direct integration with `gemini-3.5-flash-lite` via Google AI Studio.
  * **Custom / OpenAI-Compatible:** Connect to OpenRouter, self-hosted models (Ollama, LM Studio, vLLM), or official OpenAI endpoints.
* 🔄 **Independent Credential Storage:** Seamlessly toggle between Google Gemini and OpenRouter without re-entering credentials.
* 🛡️ **Privacy & Security First:**
  * API keys are stored strictly on your local machine via `chrome.storage.local`.
  * Keys are never synced across devices, never passed via URL query parameters, and never logged.
  * Zero logging of user text, keys, or raw API error payloads.
* 🎨 **Shadow DOM Isolation:** Extension UI is encapsulated in an open Shadow DOM, completely immune to host page CSS conflicts.
* 🌓 **Adaptive Themes:** Automatic light and dark theme adaptation via `prefers-color-scheme`.
* ⌨️ **Accessible & Keyboard Friendly:** Full keyboard navigation (`Tab`, `Enter`, `Space`) and quick dismissal with `Escape`.
* 📋 **Built-in Actions:** One-click copy to clipboard with visual confirmation and instant retry button on connection drops.

---

## 🔑 Obtaining API Credentials

### Google Gemini (Free Tier)
1. Visit [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click **Get API key** and create a new key.
4. Copy the key (starts with `AIzaSy...`).

### OpenRouter (Free / Custom Models)
1. Visit [OpenRouter](https://openrouter.ai/).
2. Create an account or sign in.
3. Navigate to **Keys** and generate a new key (starts with `sk-or-v1-...`).
4. In the extension settings, select **Custom (OpenAI-compatible / OpenRouter)**.
5. Use default endpoint `https://openrouter.ai/api/v1/chat/completions` and your preferred model (e.g. `meta-llama/llama-3.3-70b-instruct:free`).

---

## 📦 Installation

### Option A: From GitHub Actions Artifacts (Ready-to-Use)

1. Navigate to the **Actions** tab in this repository on GitHub.
2. Click on the latest workflow run on `main`.
3. Download either `chrome-extension` or `firefox-extension` zip artifact.
4. Unpack the zip archive into a local folder.
5. Follow the browser-specific loading steps below.

### Option B: From Source Code

Clone this repository:
```bash
git clone https://github.com/VitaliyYa/LLM-Translator.git
```

#### Google Chrome / Chromium-based Browsers
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** in the top-left corner.
4. Select the repository root folder containing `manifest.json`.

#### Mozilla Firefox (Manifest V3)
1. Open Firefox (version 115+ ESR or newer).
2. Navigate to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on...**.
4. Select `manifest.firefox.json` in the repository root directory (or `manifest.json` from the unpacked `firefox-extension.zip` artifact).

---

## ⚙️ Configuration

1. Right-click the extension icon in your browser toolbar and select **Options** (or click the extension action button).
2. Configure the settings:
   * **Target Language:** Desired translation language (e.g. `Russian`, `English`, `Spanish`, `German`).
   * **Translation Provider:** Choose `Google Gemini` or `Custom (OpenAI-compatible / OpenRouter)`.
   * **Provider Credentials:** Enter the model name and API key for your chosen provider.
3. Click **Test Connection** to verify connectivity.
4. Click **Save Settings**.

---

## 🏗️ Architecture Overview

The project relies on standard Web Platform APIs and native ES modules:

```
├── manifest.json            # Manifest V3 for Chrome/Chromium
├── manifest.firefox.json    # Manifest V3 for Mozilla Firefox
├── background.js            # Service Worker / Event Page: message routing & storage
├── gemini.js                # Browser-independent Gemini API logic (pure transforms + I/O)
├── openai.js                # Browser-independent OpenAI/OpenRouter logic (pure transforms + I/O)
├── content.js               # Content Script: selection interception & UI state machine
├── content.css              # Encapsulated styles for Shadow DOM
├── options.html             # Extension options page
├── options.js               # Options validation, provider switcher, and connection testing
├── options.css              # Options page styles (responsive + dark mode)
├── .github/workflows/       # GitHub Actions CI/CD (Node 24 LTS, test & build)
└── tests/                   # Automated unit test suite (node:test)
    ├── gemini.test.js       # Gemini request building, parsing, and error normalization
    ├── openai.test.js       # OpenAI/OpenRouter request building, parsing, and error normalization
    └── options.test.js      # Options validation and UI helpers
```

---

## 🛠️ Development & Testing

The extension runs without installing any third-party npm dependencies. Automated tests use the built-in Node.js `node:test` and `node:assert` runner (Node.js 20+ / 24 LTS):

```bash
# Verify JavaScript syntax
node --check background.js
node --check content.js
node --check gemini.js
node --check openai.js
node --check options.js
node --check tests/gemini.test.js
node --check tests/openai.test.js
node --check tests/options.test.js

# Run full automated unit test suite
node --test 'tests/*.test.js'
```

---

## 🚀 Continuous Integration (CI/CD)

The GitHub Actions workflow (`.github/workflows/build-extensions.yml`):
1. Sets up **Node.js 24 LTS**.
2. Runs JavaScript syntax verification (`node --check`) across all source files.
3. Runs all unit tests (`node --test 'tests/*.test.js'`).
4. Packages and uploads `chrome-extension.zip` and `firefox-extension.zip` as build artifacts.

---

## 📚 Documentation

* [AGENTS.md](AGENTS.md) — Operational rules, repository safety protocols, architecture, and coding conventions.
* [DECISIONS.md](DECISIONS.md) — Architecture Decision Records (ADRs).
* [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — Step-by-step roadmap and stage criteria.
* [TESTING.md](TESTING.md) — Manual and automated testing checklist.
* [CHANGELOG.md](CHANGELOG.md) — User-facing changelog (Keep a Changelog format).

---

## ⚠️ Limitations

* Text selection inside closed Shadow DOMs, restricted PDF viewers, and form inputs (`<input>`, `<textarea>`) is currently out of scope.
* Requires an active internet connection or local model endpoint server.
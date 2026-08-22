# LLM Translator — Browser Extension for Gemini API Translation

A lightweight, fast, and privacy-conscious browser extension for translating selected text on web pages using the Google Gemini API.

Built with clean Vanilla JavaScript without heavy frameworks or build tools, with native support for Chromium-based browsers (Google Chrome, Edge, Brave, etc.) and Mozilla Firefox.

---

## ✨ Features

* 🚀 **Instant Selection Translation:** Select any text on a webpage and click the floating translate icon.
* 🤖 **Powered by Google Gemini:** Uses `gemini-3.5-flash-lite` with structured output for fast and natural translations.
* 🛡️ **Privacy & Security First:**
  * API keys are stored strictly on your local machine via `chrome.storage.local`.
  * Keys are never synced across devices and never passed via URL parameters.
  * Zero logging of user text, keys, or raw API error payloads.
* 🎨 **Shadow DOM Isolation:** Extension UI is encapsulated in an open Shadow DOM, completely immune to host page CSS conflicts.
* 🌓 **Adaptive Themes:** Automatic light and dark theme adaptation via `prefers-color-scheme`.
* ⌨️ **Accessible & Keyboard Friendly:** Full keyboard navigation (`Tab`, `Enter`, `Space`) and quick dismissal with `Escape`.
* 📋 **Built-in Actions:** One-click copy to clipboard with visual confirmation and instant retry button on connection drops.

---

## 🔑 Obtaining a Gemini API Key

A free Gemini API key is required to use the extension:

1. Visit [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click **Get API key** and create a new key.
4. Copy the generated key (starts with `AIzaSy...`).

---

## 📦 Installation

### Google Chrome / Chromium

1. Clone or download this repository:
   ```bash
   git clone https://github.com/VitaliyYa/LLM-Translator.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the repository root folder.

### Mozilla Firefox

1. Run the build script `prepare_firefox.bat` (or use `manifest.firefox.json`).
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on...**.
4. Select the manifest file (`firefox_build/manifest.json` or `manifest.firefox.json`).

---

## ⚙️ Configuration

1. Right-click the extension icon in your browser toolbar and select **Options**.
2. Configure the settings:
   * **Target Language:** Desired translation language (e.g. `Russian`, `English`, `Spanish`).
   * **Gemini Model:** Model identifier (defaults to `gemini-3.5-flash-lite`).
   * **API Key:** Your key copied from Google AI Studio.
3. Click **Test Connection** to verify your key.
4. Click **Save Settings**.

---

## 🛠️ Development & Testing

The extension runs without installing any runtime dependencies. Automated testing uses the Node.js built-in `node:test` runner (Node.js 18+ required):

```bash
# Verify JavaScript syntax
node --check background.js
node --check content.js
node --check gemini.js
node --check options.js

# Run automated unit tests
node --test tests/
```

---

## 📚 Documentation

* [AGENTS.md](AGENTS.md) — Architecture, conventions, and guidelines for AI agents and developers.
* [DECISIONS.md](DECISIONS.md) — Architecture Decision Records (ADRs).
* [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — Step-by-step roadmap and stage criteria.
* [TESTING.md](TESTING.md) — Manual and automated testing checklist.
* [CHANGELOG.md](CHANGELOG.md) — Version history and upcoming releases.

---

## ⚠️ Limitations

* Text selection inside closed Shadow DOMs, restricted PDF viewers, and form inputs (`<input>`, `<textarea>`) is currently not supported.
* Requires an active internet connection to communicate with Google Gemini API.
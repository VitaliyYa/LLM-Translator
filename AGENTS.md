# AI Agent Guidelines (AGENTS.md)

This document defines the operational rules, repository safety protocols, architecture, and coding conventions for AI assistants and human developers working on the **LLM-Translator** repository.

---

### Mandatory Workflow Protocol

#### At the beginning of EVERY session:
1. Read `AGENTS.md` (this file), `IMPLEMENTATION_PLAN.md`, `CHANGELOG.md`, and `DECISIONS.md`.
2. If the task involves testing or UI verification — read `TESTING.md`.
3. Inspect current git status and branch before modifying any files.

#### Agent Execution Protocol ("Inspect before Edit"):
Before modifying code:
1. Read all required project documentation.
2. Inspect the current git branch and working tree status (`git status`).
3. Inspect the relevant source files.
4. Inspect relevant unit tests.
5. Inspect related architecture decisions in `DECISIONS.md`.
6. Compare the requested change with `IMPLEMENTATION_PLAN.md`.
7. Only then proceed to edit code.

#### Before considering a task or stage complete:
1. Run the full verification suite (syntax checks, all unit tests).
2. Update `IMPLEMENTATION_PLAN.md` — check off completed steps and record the actual state.
3. If user-visible functionality changed — add an entry to `CHANGELOG.md` following the Keep a Changelog format.
4. If an architectural decision was introduced, modified, or invalidated — update `DECISIONS.md` (do not create ADRs for ordinary implementation details).
5. If manual or automated test checklists were affected — update `TESTING.md`.
6. Verify final git status (`git status`). Ensure working tree is clean and no stray files remain.
7. Do not consider a task complete until documentation is synchronized with the code.

---

## 1. Repository Safety & Git Workflow Protocol

### Rule 1: Read-Only `main` Branch & Branching Protocol
- The `main` branch is strictly **read-only** for AI agents.
- **Never** commit directly to `main`.
- All new stage or feature branches must be created explicitly from `main` (e.g. `git checkout -b <branch-name> main`) **before** modifying any files.
- Never branch off from arbitrary or dirty feature branches unless explicitly instructed by the user.

### Rule 2: Working Tree Hygiene & Uncommitted Changes
- Before switching branches or starting work, run `git status`.
- If there are preexisting uncommitted changes not related to your task:
  - **Do not** overwrite, discard (`git reset --hard`), stash (`git stash`), or commit them.
  - Inform the user and ask how to proceed.
- Ensure only task-related files are staged and committed.

### Rule 3: Hierarchy (Task → Stage → Logical Step → Commit)
Stages in `IMPLEMENTATION_PLAN.md` represent major milestones, but work within a stage must be broken down into discrete logical steps. **Never make a single monolithic commit for an entire stage.**

```
Stage 2: Gemini Integration
│
├── Step 2.1: Request builder
│   └── commit: feat: add Gemini request builder
│
├── Step 2.2: Response parser
│   └── commit: feat: add Gemini response parser
│
├── Step 2.3: Unit tests
│   └── commit: test: cover Gemini response parsing
│
└── Step 2.4: Documentation
    └── commit: docs: update implementation and testing docs
```

### Rule 4: Commit Hygiene & Pre-Commit Checks
Before creating **every** commit:
1. Run `git diff` to review all changes.
2. Run `git diff --check` to catch whitespace errors and leftover conflict markers.
3. Verify that only files relevant to the current logical step are modified.
4. Run syntax check (`node --check <file>`) on modified JavaScript files.
5. Run relevant unit tests for the modified component.
6. Commit with a clear, descriptive message using conventional commit prefixes (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`).

### Rule 5: Strict Scope Control (No Drive-By Refactorings)
- Do not perform extraneous, stylistic, or cosmetic refactorings outside the scope of the active step.
- Leave unrelated working code alone.
- Preserve existing formatting and comments unless explicitly instructed otherwise.

### Rule 6: Plan Divergence & Conflict Resolution
- Do not modify future stages in `IMPLEMENTATION_PLAN.md` merely because you believe they should be different.
- If you discover a substantial divergence where `IMPLEMENTATION_PLAN says A` but `actual code/runtime requires B`:
  1. **Stop execution immediately.**
  2. **Report the divergence clearly to the user.**
  3. **Explain the technical rationale and consequences.**
  4. **Propose an updated plan.**
  5. **Wait for user confirmation before modifying the plan or proceeding with divergent code.**

### Rule 7: Documentation Standards
- **`CHANGELOG.md`:** Records only **user-facing or externally relevant changes** (e.g. new features, bug fixes, breaking changes). Do **not** log internal technical chores (e.g. `test: add parser test`, `docs: update plan`, `refactor: extract helper`).
- **`DECISIONS.md`:** Records major architectural decisions, trade-offs, and invariants (ADRs). Do **not** create ADRs for routine implementation details.
- **`IMPLEMENTATION_PLAN.md`:** Tracks the execution status and actual progress of project stages.

---

## 2. Project Overview & Architectural Constraints

**LLM-Translator** is a browser extension designed to translate selected text on web pages using the Google Gemini API (`streamGenerateContent`).

### Key Architectural Constraints
- **Language Standard:** All project files, documentation (`*.md`), code, and code comments **must be written in English**.
- **Technology Stack:** Vanilla JavaScript (ES2022+), HTML5, CSS3. **No heavy frameworks (React/Vue), TypeScript, or bundlers (Webpack/Vite)**.
- **Modularity:** Native ES modules (`import`/`export`). In `manifest.json`, the background service worker is declared with `"type": "module"`.
- **UI Isolation:** The content script interface (`content.js`) must be encapsulated within an open **Shadow DOM** (`attachShadow({ mode: 'open' })`) to prevent host page CSS conflicts.
- **Data Security & Privacy:**
  - The API key is stored exclusively in `chrome.storage.local` (never in `chrome.storage.sync`).
  - The API key is passed to Gemini API **only** via the `x-goog-api-key` HTTP header, never in URL query parameters.
  - Never log translated text, API keys, or raw error response bodies (`errorText`) to the console.
  - Never place real API keys in test fixtures or mock payloads.
- **Testing:** Unit tests for pure logic are written using Node.js built-in `node:test` and `node:assert` modules (no Jest/Mocha).

---

## 3. Repository Structure

```
├── manifest.json            # Manifest for Chrome/Chromium (Manifest V3)
├── manifest.firefox.json    # Manifest for Mozilla Firefox
├── background.js            # Service Worker: message routing and storage access
├── gemini.js                # Browser-independent Gemini API logic (pure transforms + I/O)
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
├── AGENTS.md                # Guide and protocols for AI agents and developers
├── DECISIONS.md             # Architecture Decision Records (ADRs)
├── CHANGELOG.md             # User-facing changelog (Keep a Changelog format)
├── IMPLEMENTATION_PLAN.md   # Step-by-step roadmap and stage criteria
├── TESTING.md               # Manual and automated testing checklist
└── README.md                # User and developer documentation
```

---

## 4. Protocols & Data Schemas

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

## 5. Coding & Module Design Rules

### Rule 1: Architecture of `gemini.js` (Pure vs I/O Classification)
`gemini.js` contains browser-independent Gemini API logic and **must not access any `chrome.*` APIs**. Functions are strictly classified:

#### Pure Functions:
- `buildGeminiRequestBody(text, targetLanguage)`
- `parseGeminiResponse(data)`
- `normalizeGeminiError(error, responseStatus, responseBody)`

**Pure functions must:**
- Have zero side effects.
- Not access `chrome.*`, `window`, `document`, DOM, or browser storage.
- Not perform network requests (`fetch`).
- Produce deterministic output for identical input.
- Be 100% testable via `node:test` without mocks or browser polyfills.

#### I/O Functions:
- `translateWithGemini({ apiKey, model, targetLanguage, text, signal })`

**I/O functions:**
- May perform network requests via standard `fetch`.
- Must support cancellation via `AbortSignal`.
- Must not access `chrome.*` APIs (background service worker passes configuration and handles storage).

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

### Rule 4: Build & Packaging Scripts
When creating or renaming files (e.g. `gemini.js`, `content.css`, `options.css`), **always** update packaging scripts in `prepare_firefox.bat` and `.github/workflows/build-extensions.yml`.

---

## 6. Verification Commands

### Per-Step Verification (Before committing a logical step):
```bash
# 1. Check git diff for whitespace or unwanted changes
git diff --check

# 2. Syntax check modified files
node --check <modified-file.js>

# 3. Run relevant unit tests
node --test tests/<relevant-test>.js
```

### Per-Stage Verification (Before completing a stage or creating a PR):
```bash
# 1. Syntax check across all JavaScript files
node --check background.js
node --check content.js
node --check gemini.js
node --check options.js

# 2. Run full test suite
node --test tests/

# 3. Verify clean git status
git status
```

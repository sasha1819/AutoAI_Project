# ADR 0007 — Electron shell: processes, build, IPC contracts, SecretStore (M5)

Status: accepted (user, 2026-10-02), with the amendments recorded at the end

## Context
M5 turns the design system into the app. Today `src/app/main`, `src/app/preload` and `src/contracts` are empty,
Electron is not installed, and there is no `SecretStore` port (ARCHITECTURE §3 lists it; it was never needed by the
CLI, which reads the key from the environment). The first screens (Welcome, Connect AI, Add project, scan progress)
need: saving and checking the user's API key, picking a project folder and PRD files, and running a scan with live
progress. ADR 0006 deferred Electron to its own ADR; this is it.

## Decision

### 1. Electron 44, three processes, locked down
- Add `electron` 44 (current) as a devDependency (it is packaged into the app at M6).
- **Main** (`src/app/main`): the composition root (`compose.ts`, like `src/cli/compose.ts`), thin IPC handlers, the
  window. **Preload** (`src/app/preload`): exposes one small typed API with `contextBridge`. **Renderer**: the React
  app in `src/ui` (a new `src/ui/main.tsx` + `index.html`).
- Window settings: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`; no remote
  content (the renderer loads only the bundled files, or the local dev server in development); `will-navigate` and
  `window.open` refused; a strict Content-Security-Policy (`default-src 'self'`; no inline scripts).

### 2. Build: Vite 8 for all three, no extra build tool
- Renderer: the existing Vite 8 + React + Tailwind setup (as in Storybook).
- Main and preload: bundled with Vite's own library build (main as ESM; preload as a single CommonJS file, since a
  sandboxed preload cannot load other local files).
- One small script, `scripts/build-electron.mjs`: builds all three; with `--dev` it starts the renderer dev server,
  builds main/preload and launches Electron. `npm run app` (dev) and `npm run app:build`.
- Rejected: `electron-vite` 5 — its peer range stops at Vite 7 (we are on Vite 8). Electron Forge / electron-builder —
  packaging is M6 and gets decided there; nothing here blocks either.

### 3. IPC contracts in `src/contracts`, zod on both sides
- One file per area (`ai.ts`, `project.ts`, `scan.ts`): a zod schema for each request, response and streamed event,
  collected in one typed `channels` map. `contracts` imports only `zod` and `core/domain`.
- Request/response channels use `ipcRenderer.invoke` / `ipcMain.handle`; streamed events (scan progress) use one
  push channel per stream with an explicit subscribe/unsubscribe.
- Every response is a serialisable `Result`: `{ ok: true, value } | { ok: false, error: { code, message } }`, codes a
  closed union per channel. Main validates every request; the preload validates every response and event before the
  renderer sees it.
- Handlers stay thin: validate -> one service call -> map to the contract. No rules in handlers (ARCHITECTURE §2).
- The renderer reaches main only through `window.autoai` (typed from the `channels` map); each feature has one
  `useX` hook that calls it.

### 4. `SecretStore` port + Electron `safeStorage` adapter
- New port `core/ports/secret-store.ts`: `save(key)`, `load()` (the key or none), `clear()`, all returning `Result`.
  An in-memory fake in `services/testing` for service tests.
- Adapter `adapters/keychain/safe-storage-secret-store.ts`: encrypts with Electron `safeStorage` (the OS keychain)
  and keeps only the encrypted blob in the app's user-data folder. If `safeStorage` is unavailable (some Linux
  setups), saving fails with a clear error code; the key is never written in plain text.
- The renderer never receives the key after it is saved: the `ai.status` channel answers only "configured: yes/no".
- The CLI keeps reading `ANTHROPIC_API_KEY` from the environment (unchanged).

### 5. Checking a key costs nothing
- Connect AI's "check key" calls a new `AiProvider.verifyAccess()`, implemented in the Claude adapter with the SDK's
  model list request: it proves the key works without spending tokens. Codes: `AI_AUTH_FAILED`, `AI_UNAVAILABLE`,
  `AI_RATE_LIMITED` (existing).

### 6. Scan progress is a service event, not a UI guess
- `scanProject` gains an optional progress callback (files read, PRDs parsed, requirements extracted, area N of M
  matched), typed in `core/domain`; the CLI ignores it, the app streams it over the `scan.progress` channel. No new
  port.

### 7. Not in this step
- `Store` (SQLite): the first screens keep the current project and its scan in memory in main. Persisting projects,
  findings and runs comes with the Workspace screens (better-sqlite3 is a native module; it needs its own note on
  rebuilding for Electron then).
- Packaging, auto-update, code signing: M6.

### 8. Boundaries (new deps rules, each with a deps-selftest case)
- `electron` only in `src/app` and `src/adapters/keychain`.
- `contracts` imports only `zod` and `core/domain`; `ui` may import `contracts` (types and schemas) but never `app`.
- Existing: `ui-no-electron`, `app-cli-no-ui`.

## Consequences
- One build tool (Vite) for renderer, main, preload and Storybook.
- The key lives only in the OS keychain-encrypted blob; a stolen renderer cannot read it.
- Tests: contract schemas are tested; handlers are tested with fake services; `SecretStore` has a contract test the
  fake and the adapter both pass (the adapter's run uses a stubbed `safeStorage`). A Playwright-for-Electron smoke
  test of the real window is added at M6.
- `verify` gains a typecheck of `src/app` and `src/contracts` (their own tsconfig) — added to ARCHITECTURE §8.

## Alternatives considered
- Plain Node type stripping for main (as the CLI, ADR 0003): Electron's main process does not reliably load `.ts`, and
  the preload must be one bundled file anyway; a build step is needed regardless.
- Keeping the key in an env var or a plain config file: refused (CLAUDE.md: secrets only via `safeStorage`).

## Amendments (2026-10-02, while building it; from the architecture, PRD and design reviews)
- Saving a key checks it first (`verifyAccess`) and stores it only if the provider accepts it (PRD Flow 1: validate,
  then store). `configured` therefore means "a key that worked when saved"; `ai:check-key` re-checks the saved key
  (e.g. revoked since). `ai:save-key` replies can carry the AI error codes.
- One scan at a time is a service rule (`createScanRunner`, SCAN_BUSY), not a handler's.
- `scan:run` accepts `prdFolder: null` (a project without PRDs, PRD Flow 1 edge case). Scan warnings and the AI error
  that stopped a scan have closed code lists; all code lists live in `contracts/codes.ts`.
- CSP: scripts stay `'self'` only; inline styles are allowed (`style-src 'self' 'unsafe-inline'`), because Radix's
  scroll lock (Modal, Select) adds a `<style>` tag and styles cannot run code. Fonts and images ship as files
  (`assetsInlineLimit: 0`), not inlined `data:` URLs. `frame-ancestors` is not used (ignored in a meta tag).
- IPC calls are accepted only from our own page (sender-frame URL check, `own-url.ts`, file URLs compared as URLs so
  Windows paths work). Progress pushes skip a window that has closed mid-scan.
- Typecheck: `src/app` and `src/contracts` are covered by the root tsconfig (no separate one needed).
- A Playwright-for-Electron smoke test exists now (`node scripts/app-smoke.mjs`, after `npm run app:build`; not in
  verify, since it opens a window). Scripts clear `ELECTRON_RUN_AS_NODE`, which VS Code terminals set.
- The renderer root lives in `src/ui/app` (ARCHITECTURE §7); deps rules close it to the design system and let screens
  import only its `bridge.ts`; tokens:check holds it to the screens' rules.
- Window frame (user decision, 2026-10-02): the native frame, with the app's menus in the system menu bar
  (Electron `Menu`, built from standard roles). The screens do not draw a title bar, menus or window buttons; mockup
  4's drawn title bar (logo, menus, search, window controls) is a recorded deviation. "Devices" and multi-window stay
  out (not MVP).

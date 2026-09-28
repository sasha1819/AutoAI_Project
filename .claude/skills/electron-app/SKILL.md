---
name: electron-app
description: How the Electron shell of AutoAI is wired — main/preload/renderer split, composition root, IPC contracts, streaming events, secret storage, packaging. Use when working in src/app, src/contracts, on IPC channels, app startup, the API-key flow, or the CLI composition root.
---

# Electron app skill

- `src/app/main/compose.ts` is the ONLY place that creates adapters and injects them into services. `src/cli/compose.ts` does the same for the terminal. Both call the same services.
- IPC: every channel has a zod request/response schema in `src/contracts/`. Handler = validate -> one service call -> return `Result`. No rules in handlers.
- Streaming (scan progress, run steps): main emits typed events; renderer subscribes through the preload API. Events are defined in `contracts` too.
- Preload exposes a small typed API with `contextBridge`. `contextIsolation: true`, `nodeIntegration: false`, no remote content.
- Renderer never sees the API key after it is saved. Keychain access = `adapters/keychain` using Electron `safeStorage`.
- Screens to build (MVP): Welcome, Connect AI, Add project + scan progress, Wow summary, Spec vs Code findings, Workspace (test list, step list view, read-only Code tab, Run + live log), Results + diagnosis, simple Reports, Settings > AI & models.
- Do NOT build: flow canvas, billing/plans, PR impact, Release Readiness, Security/Accessibility tabs, Explore, Schedules (see `docs/LATER.md`).
- Honest privacy wording: the repo is stored and scanned locally; relevant code snippets go to the user's own AI provider.
- UI work also loads the `design-system` skill.

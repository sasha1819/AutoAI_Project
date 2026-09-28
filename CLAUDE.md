# AutoAI — project guide for Claude Code

AutoAI is a desktop app (Electron) for QA/automation. It scans a repo + PRD files, finds spec-vs-code mismatches,
generates Playwright tests, runs them, and explains failures. Builder: one solo developer. Keep explanations simple and short.

## The one idea that decides everything
The LOGIC is the product. The UI is a thin skin. Logic lives in a pure `src/core`; technology sits behind ports in `src/adapters`;
use cases in `src/services`; the design system is separate from screens. This is enforced by tools (`npm run verify`), not by goodwill.

## Source of truth
- HOW we build: `docs/ARCHITECTURE.md` (layers, where code goes, standards, Definition of Done) — read it every task
- WHAT we build: `docs/PRD.md` (read Sections 1 and 10 before new work)
- Design screens: `docs/design/`
- Tasks and progress: `BUILD-LOG.md` · Not now: `docs/LATER.md` · Decisions: `docs/adr/`

## MVP boundary (do not cross)
Web-only (Chromium via Playwright). One loop: scan -> findings -> generate tests -> run -> diagnose. BYOK only.
No accounts, billing, mobile, security tab, accessibility tab, explore mode, scheduling, PR impact, visual flow canvas.
New idea? Run `/scope-check`.

## Stack
TypeScript 5.x (strict; NOT TypeScript 7 — dependency-cruiser does not support it yet), Node, Vitest, ESLint + Prettier, zod,
Playwright, better-sqlite3, Electron + React + Tailwind, Storybook, dependency-cruiser.

## Layout
```
src/core/       domain, rules, prompts, parsing, ports   (pure: no I/O, no frameworks)
src/services/   use cases that orchestrate core through ports
src/adapters/   claude/ playwright/ sqlite/ fs/ keychain/   (implement ports)
src/contracts/  IPC schemas shared by main and ui
src/app/        Electron main + preload (composition root, thin IPC handlers)
src/cli/        terminal entry (second composition root)
src/ui/         design-system/{tokens,primitives,patterns} + features/<name>
fixtures/       sample repo + PRD + expected-findings.json (accuracy test)
```

## Non-negotiable rules
1. Every rule/threshold/status decision lives in `core/rules`. Nowhere else.
2. Search before you write. Reuse ports, functions and components. Never duplicate.
3. Follow the reference slice; new patterns/ports/dependencies need an ADR the user approves.
4. Tests first for core logic. Fake ports for services. A story per UI state.
5. The AI never decides pass/fail; Playwright does. AI output is zod-validated; confidence < 0.7 => `needs_review`.
6. No raw colors/px/inline styles in features. No `any`. No `utils.ts`. Secrets only via `safeStorage`.
7. One task per run, small Conventional Commits, `npm run verify` green before commit.

## How to work
Use `/build-next` (the loop). Helpers: `/new-usecase`, `/new-component`, `/scope-check`.
Skills: `architecture`, `design-system`, `code-standards`, `scan-engine`, `reliability-rules`, `playwright-generation`, `electron-app`.
Agents: `verifier`, `architecture-reviewer`, `design-system-reviewer`, `prd-reviewer`, `scan-evaluator`.

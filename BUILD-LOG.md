# BUILD-LOG

Order is designed to avoid refactors: foundation -> one reference slice -> logic -> design system -> screens -> Electron.
Tick a box only when `npm run verify` is green and reviewers have no blockers. `/build-next` takes the first unticked task.

## M0 — Foundation (no product code yet)
- [x] Init repo: `package.json`, TypeScript **5.x**, `tsconfig` (strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes), ESLint (typescript-eslint strict) + Prettier, Vitest, folders from ARCHITECTURE.md (empty, with `.gitkeep`)
- [ ] Scripts: `typecheck`, `lint`, `test`, `deps:check` (`depcruise src --config .dependency-cruiser.cjs`), `tokens:check` (`node scripts/check-design-tokens.mjs`), `verify` (runs all). Confirm `deps:check` shows a non-zero module count once code exists
- [ ] Prove the guardrails: temporarily add one illegal import, see `deps:check` fail, remove it
- [ ] Shared building blocks: `Result` type, branded ids, error-code convention (in `core/`), with tests

## M1 — Reference slice + scan logic (CLI only)
- [ ] REFERENCE SLICE: "PRD text -> Requirement[]" through core (`parsing/prd`, domain types) -> service `ExtractRequirements` -> `RepoReader`/fs adapter -> CLI command. Full tests. All later code copies this shape
- [ ] Fixtures: tiny sample web app + PRD + `fixtures/expected-findings.json` (3 planted mismatches, 2 correct features)
- [ ] Relevance rule (`core/rules/relevance`): which files matter for a requirement
- [ ] Confidence policy rule (`core/rules/confidence`), table-tested
- [ ] Matching prompt + finding parser (`core/prompts`, `core/parsing/finding`) tested with recorded AI responses
- [ ] `AiProvider` port + Claude adapter (retries, rate limits, token count, `INVALID_AI_OUTPUT`)
- [ ] Service `ScanProject` + CLI `npm run scan`; run `scan-evaluator` on fixtures
- [ ] Test generation: prompt + acceptance rule + `GenerateTests` service; generated specs compile with tsc

## M2 — Runner (CLI only)
- [ ] `run-status` rule (retry-once, flaky vs failed), table-tested
- [ ] `TestRunner` port + Playwright adapter, typed step events, failure capture
- [ ] Service `RunTest`; CLI `npm run run-test`

## M3 — Diagnosis
- [ ] Diagnosis prompt + parser + rule; service `DiagnoseFailure` (only for confirmed failures)

## M4 — Design system (before any screen)
- [ ] Storybook set up; tokens extracted from `docs/design/` (dark theme, semantic status colors)
- [ ] Primitives with all states and stories: Button, IconButton, Input, Select, Checkbox, Switch, Badge, Tabs, Tooltip, Popover, Modal, Card, ProgressBar, Table, Spinner, EmptyState, CodeBlock, Toast, Icon
- [ ] Patterns: StatusPill, SeverityTag, ConfidenceMeter, RequirementTag, AiActionButton, FindingCard, StepRow, RunLogLine, SidebarList

## M5 — Electron shell + screens
- [ ] Electron + React scaffold, `compose.ts`, preload, contracts for first channels, `SecretStore` (safeStorage)
- [ ] Welcome + Connect AI (key check) + Add project + scan progress (streaming)
- [ ] Wow summary + Spec vs. Code findings
- [ ] Workspace: test list, step list view, read-only Code tab
- [ ] Run + live run log; Results + diagnosis panel

## M6 — Wrap-up
- [ ] Simple Reports rollup; Settings > AI & models (BYOK, test connection)
- [ ] Package for macOS/Windows; try on 3 real repos; fix what real repos reveal

## Decisions & notes
- (one line per decision, newest first; structural decisions also get an ADR)
- 2026-09-28 Core is Node-free and deterministic by tooling: `src/core/tsconfig.json` (`types: []`) is a second typecheck pass; ESLint bans `Date.now`, `Date()`, zero-arg `new Date()`, `Math.random` in core.
- 2026-09-28 tsc is typecheck-only (`moduleResolution: Bundler`, `noEmit`); CLI/Electron run through a TS runner/bundler later. One root tsconfig, no DOM/JSX until the UI gets its own in M4/M5.
- 2026-09-28 M0 #1 added `typecheck`/`lint`/`test`/`format` scripts so the tools are runnable; `deps:check`/`tokens:check`/`verify` stay in M0 #2.
- 2026-09-28 Missing design screens (Spec vs. Code, Workspace, Run results, Reports, Settings) will be added by the user before M4.
- 2026-09-28 Finding follows ARCHITECTURE vocabulary: separate `Evidence` (file, lines, snippet) type and a stored `reviewStatus`; PRD 9's flat table is a sketch.
- 2026-09-28 PRD parser accepts markdown/plain text only for now; .docx moved to `docs/LATER.md`.

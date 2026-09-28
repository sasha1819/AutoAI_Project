# BUILD-LOG

Order is designed to avoid refactors: foundation -> one reference slice -> logic -> design system -> screens -> Electron.
Tick a box only when `npm run verify` is green and reviewers have no blockers. `/build-next` takes the first unticked task.

## M0 — Foundation (no product code yet)
- [x] Init repo: `package.json`, TypeScript **5.x**, `tsconfig` (strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes), ESLint (typescript-eslint strict) + Prettier, Vitest, folders from ARCHITECTURE.md (empty, with `.gitkeep`)
- [x] Scripts: `typecheck`, `lint`, `test`, `deps:check` (`depcruise src --config .dependency-cruiser.cjs`), `tokens:check` (`node scripts/check-design-tokens.mjs`), `verify` (runs all). Confirm `deps:check` shows a non-zero module count once code exists
- [x] Prove the guardrails: temporarily add one illegal import, see `deps:check` fail, remove it
- [x] Tighten deps:check to match ARCHITECTURE section 1 (approved by user in chat 2026-09-28): core/services/contracts import only zod from npm (allowlist, no node built-ins in services/contracts); fail on unresolvable imports from src; app/cli must not import ui; services/adapters must not import contracts; ui must not import electron or node built-ins. Re-run the boundary probe
- [x] Shared building blocks: `Result` type, branded ids, error-code convention (in `core/`), with tests

## M1 — Reference slice + scan logic (CLI only)
- [x] REFERENCE SLICE: "PRD text -> Requirement[]" through core (`parsing/prd`, domain types) -> service `ExtractRequirements` -> `RepoReader`/fs adapter -> CLI command. Full tests. All later code copies this shape
- [x] Fixtures: tiny sample web app + PRD + `fixtures/expected-findings.json` (3 planted mismatches, 2 correct features)
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
- 2026-09-28 Fixtures: runnable no-dependency shop (`fixtures/sample-repo`), PRDs in two styles (`shop.md` tagged; `checkout.md` written like `docs/PRD.md`, which today's parser extracts 0 from, per user), answer key keyed by PRD location (file + line) with evidence, `parser` status and expected severity. `src/cli/fixtures.test.ts` keeps the key true to the PRDs, parser and cited lines, and blocks answer hints inside sample-repo; `fixtures/sample-repo.test.mjs` proves the planted bugs are real. `passWithNoTests` removed from Vitest (it would hide a broken include).
- 2026-09-28 CONFIRMED gap: `docs/PRD.md` (a real doc-editor export) yields 0 requirements with the heading/tag parser. Kept in `docs/LATER.md` as validated; the fixture's `checkout.md` makes the accuracy test count it.
- 2026-09-28 OPEN: a PRD file with no tags and no headings (plain prose .txt) yields 0 requirements; the CLI now names such files. Whether to fall back to one requirement per paragraph is undecided.
- 2026-09-28 Reference slice shape to copy: core rule/parsing (table tests) -> port type in `core/ports` with a closed error-code union -> service `fn(deps, input): Promise<Result<T, PortCodes | OwnCodes>>` tested with an in-memory fake that records calls -> adapter with `translate()` (expected errno -> code, anything else rethrown) tested on a real temp dir -> `cli/compose.ts` wiring + thin entry (parseArgs + zod, exit 0/1/2) tested by spawning `node`.
- 2026-09-28 Requirement = {tag, area, text, source{file,line}}; no id until storage. `tag` is "Area 1.2" for tagged items, else the heading title, and is not unique. Parser is generic (no product words). Coverage proof: deleting prd.test.ts drops branches to 71.7%, deleting its tagged-items block to 88.3%; verify fails both times.
- 2026-09-28 Shared port contract-test suite deferred until a port has a second real implementation (a vitest-importing file in core would break npm-only-zod). CLI entry coverage shows 0% because it runs in a spawned process; its spawn tests cover it.
- 2026-09-28 ADR 0002 is reserved for the Anthropic SDK decision (with the `AiProvider` + Claude adapter task); ADR numbers are never reused.
- 2026-09-28 ADR 0003 (accepted): TypeScript runs on Node's built-in type stripping (`node src/cli/x.ts`), no tsx/build step. tsconfig is `NodeNext` + `allowImportingTsExtensions` + `erasableSyntaxOnly`, so every relative import ends in `.ts` (tsc rejects extensionless: TS2835) and `enum`/`namespace` don't compile. `engines: >=22.18`, `.nvmrc` = 24. deps:selftest now uses `.ts`/`.tsx` specifiers. Replaces the earlier `moduleResolution: Bundler` note.
- 2026-09-28 Coverage (user request): @vitest/coverage-v8 5.0.2; `coverage-thresholds.json` (folders + 90% lines/branches, aggregate per folder) feeds both the Vitest thresholds and `coverage:scope`. Vitest alone passes silently for a folder glob matching no files, so `coverage:scope` fails on a missing folder, an unmeasured or stale file, or a malformed config, and prints a NOTICE for an empty folder. `npm test` stays plain; verify runs `test:coverage` + `coverage:scope`.
- 2026-09-28 `lock:check` + `lock:selftest` run first in `verify` (user request): every `optionalDependencies` entry in package-lock.json must resolve to a lock entry, else fail with the rebuild command. Generic, covers rolldown and lightningcss binaries.
- 2026-09-28 Type-level rules are pinned with `// @ts-expect-error` in tests (enforced by `npm run typecheck`) and mutation-checked. Use this for every future compile-time rule.
- 2026-09-28 Ids are zod-branded strings (1-128 chars, no whitespace) for the 7 PRD entities in `core/domain/ids.ts`; a branded id only comes from parsing, so no `as` casts. Schema const and type share one name.
- 2026-09-28 `Result<T, E extends DomainError>` with `ok`/`err` only (no map/unwrap until needed). `ErrorCode = Uppercase<string>`: lowercase codes don't compile; each use case declares its own closed union of codes, no global registry.
- 2026-09-28 zod 4.6.5 added (runtime dependency, exact pin). npm/cli#4828 hit again on install; lockfile regenerated per the recipe below.
- 2026-09-28 `deps:selftest` (scripts/deps-selftest.mjs, in `verify`) builds a fake src/ + fake packages in the OS temp dir and proves each rule: 25 illegal cases trip exactly their rule, 18 legal files (incl. .tsx) stay clean. Mutation-checked. Add a case whenever a rule is added.
- 2026-09-28 Layer rules are now an allowlist per the user: core/services/contracts import only zod from npm; no Node built-ins in core/services/contracts/ui; services/adapters never import contracts; ui never imports electron; app/cli never import ui; unresolvable imports fail.
- 2026-09-28 Gap found: `core-no-io-libraries` is a blocklist of 5 packages, so core can import any other npm package (proved with `semver`: exit 0); review found 5 more rules weaker than ARCHITECTURE. Fix is the new unticked M0 task, pending user OK.
- 2026-09-28 Guardrails proven: each of the 14 deps:check rules fired alone (exit 1) on a throwaway illegal import; 14 legal modules across all layers passed (exit 0). `npm run verify` fails on a core -> adapter import.
- 2026-09-28 `depcruise --output-type json` exits 0 even with violations; only the default reporter (used by deps:check) sets the exit code. Test files are excluded from deps:check by config.
- 2026-09-28 If adding a dev dependency makes vitest fail with "Cannot find native binding" (npm/cli#4828 drops `@rolldown/binding-*` from the lock), delete `node_modules` + `package-lock.json` and `npm install` fresh.
- 2026-09-28 deps:check has no `tsConfig` option: all imports are relative. If path aliases are ever added, set `options.tsConfig` in `.dependency-cruiser.cjs` or aliased imports go unresolved and skip the layer rules.
- 2026-09-28 `verify` = format:check, typecheck, lint, deps:check, tokens:check, test (fail-fast). format:check is one step beyond ARCHITECTURE section 8's list, on purpose.
- 2026-09-28 Core is Node-free and deterministic by tooling: `src/core/tsconfig.json` (`types: []`) is a second typecheck pass; ESLint bans `Date.now`, `Date()`, zero-arg `new Date()`, `Math.random` in core.
- 2026-09-28 tsc is typecheck-only (`moduleResolution: Bundler`, `noEmit`); CLI/Electron run through a TS runner/bundler later. One root tsconfig, no DOM/JSX until the UI gets its own in M4/M5.
- 2026-09-28 M0 #1 added `typecheck`/`lint`/`test`/`format` scripts so the tools are runnable; `deps:check`/`tokens:check`/`verify` stay in M0 #2.
- 2026-09-28 Missing design screens (Spec vs. Code, Workspace, Run results, Reports, Settings) will be added by the user before M4.
- 2026-09-28 Finding follows ARCHITECTURE vocabulary: separate `Evidence` (file, lines, snippet) type and a stored `reviewStatus`; PRD 9's flat table is a sketch.
- 2026-09-28 PRD parser accepts markdown/plain text only for now; .docx moved to `docs/LATER.md`.

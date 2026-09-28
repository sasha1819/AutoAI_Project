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
- [x] Relevance rule (`core/rules/relevance`): which files matter for a requirement
- [x] Confidence policy rule (`core/rules/confidence`), table-tested
- [x] Matching prompt + finding parser (`core/prompts`, `core/parsing/finding`) tested with recorded AI responses
- [x] `AiProvider` port + Claude adapter (retries, rate limits, token count, `INVALID_AI_OUTPUT`)
- [x] Service `ScanProject` + CLI `npm run scan`; run `scan-evaluator` on fixtures (evaluator run pending: needs the user's ANTHROPIC_API_KEY)
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
- 2026-09-29 Test fakes for ports live in `src/services/testing/` (in-memory RepoReader, scripted AiProvider), shared instead of copied; deps rule `test-fakes-only-in-tests` keeps production code from importing them.
- 2026-09-29 ScanProject: batches by area (`batchRequirements`), picks files per batch round-robin (`rankFilesForBatch`), fits the budget, prompts, parses. An invalid answer is retried once (`INVALID_AI_OUTPUT_ATTEMPTS`); still invalid → the batch is `notScanned` with a warning. After an AI error, `aiErrorAction` decides: auth/model/rate-limit/outage stop the scan (findings so far kept, `stoppedBy` set, exit 1), one-prompt problems (truncated/refused/bad request) skip just that batch. No PRD files → warning and 0 AI calls. `sourceFiles` = source files found in the repo.
- 2026-09-29 `npm run scan -- --repo --prds [--out] [--model] [--effort] [--record] [--json]`: key from `ANTHROPIC_API_KEY` only (exit 2 with a BYOK message otherwise); model = `--model` ?? `AUTOAI_MODEL` ?? `claude-sonnet-5`; prints tokens and an approximate cost (list prices in `adapters/claude/pricing.ts`); a failed `--out`/`--record` write is reported but never loses the paid-for result. CLI tests spawn node only on paths that never reach the network.
- 2026-09-28 Claude adapter (ADR 0002): `createClaudeAiProvider({apiKey, model?, effort?})`, one non-streaming `messages.create` (max_tokens 16000, adaptive thinking, `output_config` effort + JSON schema from `buildMatchingPrompt().answerSchema`). `authToken: null` and a pinned baseURL so neither `ANTHROPIC_AUTH_TOKEN` nor `ANTHROPIC_BASE_URL` from the environment is used (tested). Retries are the SDK's (tested with a real 429 then 200). New deps rule `only-claude-adapter-uses-anthropic-sdk`. Tests serve API-shaped responses through the SDK's injected fetch; no live calls.
- 2026-09-28 not_implemented findings now keep a severity on the same scale as mismatches (user), so missing features can be prioritised like bugs; only a match has none. Fixture Account 3.1 expects "medium".
- 2026-09-28 ADR 0002 accepted (user): `@anthropic-ai/sdk` only in `adapters/claude`; BYOK key passed in, baseURL pinned to api.anthropic.com; model configurable, default `claude-sonnet-5`, effort default high; structured outputs with the zod parser as the gate; seven AI error codes; tests use recorded responses via the SDK's injected fetch.
- 2026-09-28 For ScanProject: batch requirements per area (scan-engine skill) with no size limit yet; if a big area's prompt gets long, cap requirements per batch. Pass `buildMatchingPrompt(...)` itself to `parseMatchingResponse` (the prompt carries the requirements and files it showed, so they cannot drift). A model or recording is still needed: scan-evaluator needs the Claude adapter (ADR 0002) + ScanProject + `npm run scan`; no numbers until then.
- 2026-09-28 Prompt budget, sized against real prompts: fixture area batches ~10k chars (~2.5k tokens); AutoAI's own src (real TS, median file 1.2k chars, max 5.3k) gives 8 files = 18.8k chars of code, a 25k-char prompt (~6.4k tokens). Real app files are often 5-15k chars, so `PROMPT_FILE_BUDGET_CHARS` = 60k (~15k tokens) keeps 8 typical files whole. Worst case: 2k system + 60k code + ~9k repo file list (`REPO_FILE_LIST_LIMIT` 300 paths) ≈ 18k tokens ≈ $0.09 input per prompt at claude-opus-5 ($5/MTok). Files that do not fit are omitted and named in the prompt, never cut. Estimates are chars/4; the Claude adapter can count exactly (count_tokens).
- 2026-09-28 Matching: `buildMatchingPrompt` (fixed cacheable system prompt; user part has R1..Rn requirements, the repo's source file list as the overview PRD 4.3 asks for, line-numbered code, omitted files; project text escaped so it cannot close the prompt's tags). `parseMatchingResponse` is the only gate for Claude's answer: strict on requirement id/type/confidence/explanation (else `INVALID_AI_OUTPUT`), lenient on evidence (malformed = missing) and severity; then `verifyEvidence` (snippet >= 8 non-space chars, <= 30 lines, within cited lines +-2, only in files the prompt showed) and `reviewFinding` (adds `UNVERIFIED_EVIDENCE`). Severity is kept for mismatches only (`rules/severity.ts`). Parser tests use hand-written replies in the prompt's shape until the adapter records real ones.
- 2026-09-28 DONE (matching task) — was TODO: verify cited evidence against the real file (AI may hallucinate lines/snippets). Pure `core/rules/evidence.ts` `verifyEvidence(evidence, fileText)` (the service reads the file via the port), also "unverified" if the cited file was not among the ranked relevant files; `reviewFinding` takes the result as input and adds `UNVERIFIED_EVIDENCE`, staying the only place that sets reviewStatus. The full `Finding` (severity, explanation) arrives with the finding parser.
- 2026-09-28 Confidence policy: `CONFIDENCE_THRESHOLD` 0.7 (>= is confident; diagnosis reuses `isConfident`). `reviewFinding` returns reviewStatus plus reasons (`LOW_CONFIDENCE`, `MISSING_EVIDENCE`); only a mismatch must cite evidence. Reasons are backend data only; the visible decision log stays in LATER. `Confidence` is a branded 0..1 number, `Evidence` is {file, lines [start,end], snippet}.
- 2026-09-28 scan-engine skill updated (user): relevance is "keyword scoring over file paths and local file text", matching relevance.ts.
- 2026-09-28 DONE (matching task, see budget line above) — was TODO: a TOTAL character budget for the file contents sent to Claude. The relevance rule caps the file count (8) and skips files over `MAX_SOURCE_CHARS` (200k), but eight 150k files would still be too much.
- 2026-09-28 Relevance rule: keyword overlap scored filename 3 / folder 2 / file text 1, area words x2, top `RELEVANT_FILE_LIMIT` (8), any script (Unicode letters). Deviates from the scan-engine skill's "path scoring": file text is matched too (lowest weight), because paths alone cannot find `src/app.js` for fixture Cart 1.3. Fixture check: every cited evidence file ranks in the top 3. `isSourceFile` skips tests (so generated `tests/autoai` specs never feed back), build output, hidden paths, `.d.ts`/`.min.js`. Possible later: code stop-words (button, form, return) if ranking gets noisy.
- 2026-09-28 Fixture gains a not-implemented case (user request): Account 3.1 order history, which the shop never built. Its key entry lists `absentTerms` instead of evidence; tests pin its type and fail if it is relabelled, dropped from key or PRD, or if the feature appears in sample-repo. scan-evaluator now compares by PRD file + line and counts not_implemented reported as mismatch as a false positive.
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

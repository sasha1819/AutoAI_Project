# AutoAI — Engineering Architecture (source of truth for HOW we build)

The product is the LOGIC (scan, match, decide, classify, explain). The UI is a thin skin on top.
So: logic lives in a pure core that knows nothing about Electron, React, Claude, Playwright, SQLite or the disk.
Everything else plugs into the core through small interfaces (ports). Tools enforce this; it is not a suggestion.

## 1. Layers

| Layer | Folder | Contains | May import | Must NOT import |
| --- | --- | --- | --- | --- |
| Core | `src/core/` | domain types, business rules, prompt builders, output parsing/validation, scoring, ports (interfaces) | only `zod` and itself | Node built-ins, Electron, React, Playwright, Claude SDK, SQLite, any other layer |
| Services | `src/services/` | use cases: orchestrate core through ports (ScanProject, GenerateTests, RunTest, DiagnoseFailure) | core | adapters, app, ui, cli |
| Adapters | `src/adapters/<tech>/` | implementations of ports: `claude`, `playwright`, `sqlite`, `fs`, `keychain` | core | services, app, ui, cli, other adapters |
| Contracts | `src/contracts/` | IPC message types + zod schemas shared by main and ui | core/domain | everything else |
| App (Electron) | `src/app/main`, `src/app/preload` | composition root, IPC handlers (thin: validate -> call service -> return) | everything except ui | business rules (they belong in core) |
| CLI | `src/cli/` | second composition root for terminal use (same services) | everything except ui | business rules |
| UI | `src/ui/` | design system + feature screens | contracts, core/domain (types only) | services, adapters, app, cli, core/rules |

Dependency direction: `ui -> contracts`, `app/cli -> services -> core <- adapters`. Nothing points into `ui`.

## 2. Where does this code go?

| I am writing... | It goes in |
| --- | --- |
| "confidence below 0.7 means needs_review" | `core/rules/` |
| "retry once; pass on retry = flaky" | `core/rules/` |
| text of a prompt sent to Claude | `core/prompts/` (pure function returning a string) |
| parsing + validating what Claude returned | `core/parsing/` (zod) |
| the actual HTTPS call to Claude | `adapters/claude/` |
| running Playwright | `adapters/playwright/` |
| reading files / walking the repo | `adapters/fs/` |
| SQL and migrations | `adapters/sqlite/` |
| "scan project = read repo, parse PRDs, match, save" | `services/` |
| handling an IPC message | `app/main/ipc/` (thin) |
| a button, badge, input, table | `ui/design-system/primitives/` |
| a repeated combination (StatusPill, FindingCard) | `ui/design-system/patterns/` |
| a whole screen | `ui/features/<feature>/` |
| colors, spacing, type sizes | `ui/design-system/tokens/` |

If a rule is decided anywhere except `core/rules`, it is in the wrong place.

## 3. Ports (the only interfaces we invent up front)
`AiProvider` (complete a prompt) · `RepoReader` (list/read files) · `TestRunner` (run a spec, emit step events) ·
`Store` (save/load projects, requirements, findings, runs) · `SecretStore` (API key) · `Clock` and `Ids` (so tests are deterministic).
Add a new port only when a second implementation or a test double is actually needed. Record it in an ADR.

## 4. Domain vocabulary (use these words in names; do not invent synonyms)
Project · Requirement (tag, text, area) · Finding (type, severity, evidence, confidence, reviewStatus) · Evidence (file, lines, snippet) ·
TestCase · Run (status) · Step · Diagnosis · Confidence · ReviewStatus (`confirmed` | `needs_review`) · RunStatus (`passed` | `failed` | `flaky` | `not_run`).

## 5. Code standards
- TypeScript strict, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. No `any`. No non-null `!` outside tests.
- Core is pure: functions take data, return data. No hidden clocks, randomness or globals — pass them in.
- Expected failures are values (`Result<T, DomainError>` with a typed `code`); exceptions are for bugs only.
- All data crossing a boundary (AI output, IPC, disk, env) is validated with zod at that boundary. Inside, types are trusted.
- Branded ids (`RequirementId`, `RunId`) so ids cannot be mixed up.
- Small files, one main export per file, names from the vocabulary above. No `utils.ts` / `helpers.ts` / `common.ts` dumping grounds.
- Comments explain WHY, never restate WHAT. Public functions in core get a one-line doc.
- No copy-paste: the second time is a warning, the third time is extraction. UI primitives are the exception: build the full set once (section 7).
- Git: Conventional Commits (`feat(core): ...`). One task per commit. Decisions that affect structure get an ADR in `docs/adr/`.

## 6. Testing (logic first)
| Layer | Test type | Bar |
| --- | --- | --- |
| core | unit tests, written BEFORE or with the code; table-driven for rules | >= 90% lines and branches on `core/rules` and `core/parsing` |
| services | tests with in-memory fake ports (no network, no disk) | every use case: happy path + each failure code |
| adapters | contract tests against the port; Claude adapter tested with recorded responses, never live in CI | each port method |
| ui | component tests (Testing Library) + a story per state | every primitive and pattern |
| whole app | fixtures accuracy run (`scan-evaluator`) and later Playwright-for-Electron smoke | before each milestone ends |

## 7. UI and design system (design never lives inside logic or screens)
Four tiers, each may only use the tier above it:
1. `tokens/` — the ONLY place with raw colors, spacing, radii, font sizes, shadows (CSS variables + Tailwind theme). Dark theme first, theme-switchable.
2. `primitives/` — Button, IconButton, Input, Select, Checkbox, Switch, Badge, Tabs, Tooltip, Popover, Modal, Card, ProgressBar, Table, Spinner, EmptyState, CodeBlock, Toast, Icon.
3. `patterns/` — reusable combinations built from primitives: StatusPill, SeverityTag, FindingCard, StepRow, RunLogLine, RequirementTag, AiActionButton, ConfidenceMeter, SidebarList.
4. `features/<name>/` — screens. They compose patterns and primitives, hold view state only, call the outside world through one hook per feature (`useX`) that talks to the IPC contract.

Rules:
- Features never contain raw colors, pixel values, or inline `style`. `npm run tokens:check` fails if they do.
- Status colors live in ONE place (StatusPill / SeverityTag map domain status -> token). Green = passed, red = failed, blue = running, yellow = flaky/warning, gray = not run. Violet = AI actions and primary buttons only.
- Every primitive/pattern has all states designed: default, hover, focus-visible, disabled, loading, error, empty (where relevant).
- Accessibility baseline: keyboard reachable, visible focus, labels on inputs, role/aria on custom widgets, contrast from tokens.
- A story per component state (Storybook). Build the component in the story first, then use it in a screen.
- Features are isolated: one feature never imports another. Shared things move down to patterns.

## 8. Definition of Done (a task is not done until all are true)
1. `npm run verify` passes (typecheck, lint, tests, `deps:check`, `tokens:check`).
2. New logic has tests; new/changed rules are table-tested.
3. No rule decided outside `core/rules`; no raw design values in features.
4. Reused an existing primitive/pattern/port if one existed (searched first).
5. Reviewed by `architecture-reviewer` (and `design-system-reviewer` if `src/ui` changed) with no blockers.
6. `BUILD-LOG.md` ticked, ADR added if structure changed, committed.

## 9. Order of work that prevents refactors
Foundation (tooling + boundaries) -> one reference slice through every layer -> more logic slices -> design system (tokens, primitives, patterns in Storybook) -> screens -> Electron wiring.
New code copies the reference slice's shape. If the slice is wrong, fix the slice first.

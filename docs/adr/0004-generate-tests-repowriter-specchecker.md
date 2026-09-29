# ADR 0004 — Generating Playwright tests: a confined test writer and an in-process compile check

Status: accepted (user, 2026-09-29)

## Context
PRD §4.4: for requirements where a test is feasible, ask Claude for a Playwright test (TypeScript) and write it to `tests/autoai/` in the user's repo. It also says to typecheck the file before calling it "ready", because a generated test that doesn't compile is worse than no test. The playwright-generation skill adds the rules: first-line requirement comment, at least one `expect(`, no `waitForTimeout`/`test.only`/`.skip`, relative URLs only.

Today AutoAI can only *read* a repo (`RepoReader`) and cannot type-check code. ARCHITECTURE §3 lists neither capability, so this ADR adds two ports and two runtime dependencies.

## Decision

### 1. Port `TestWriter` — may only ever write inside `<repo>/tests/autoai/`
`writeGeneratedTest(repoRoot, fileName, text)` → Result with codes `REPO_NOT_FOUND`, `PATH_NOT_ALLOWED`, `FILE_EXISTS`, `PATH_UNWRITABLE`.

It is deliberately narrower than a general "repo writer": the confinement is part of the port's contract, so no caller can widen it. The adapter (`adapters/fs`) enforces it itself, the same way `RepoReader` guards reads:
- `fileName` must be a plain name matching `^[a-z0-9][a-z0-9-]*\.spec\.ts$`: no separators, no `..`, no absolute paths.
- `realpath(repoRoot)/tests/autoai` is created if missing. If `tests` or `tests/autoai` exists as a **symlink**, or resolves anywhere other than exactly `realpath(repoRoot)/tests/autoai`, the write is refused (`PATH_NOT_ALLOWED`).
- The file is created with exclusive-create (`wx`). An existing path, *including a symlink planted there*, is never followed or replaced (`FILE_EXISTS`).
- Contract tests on a temp dir cover each case: `../`, an absolute name, a symlinked `tests/`, a symlinked `tests/autoai/`, a symlink at the target path, and an existing file.

The file name itself comes from a core rule (`core/rules/generated-test.ts`): `<area>-<slug>.spec.ts`, kebab-case, from the requirement.

### 2. When a test file for the requirement already exists: **skip and report, never overwrite**
- **Chosen:** skip. The existing file is left untouched and the result lists it as `exists`, telling the user to delete the file to regenerate.
- **Rejected: overwrite.** Users are expected to edit generated tests (PRD Flow 3 keeps a file watcher for exactly that), and silently destroying their edits is the worst outcome.
- **Rejected: versioning** (`-2.spec.ts`). It creates duplicate tests for one requirement that both run in CI and double every failure; it's clutter the user must clean up.
- Skipped requirements cost no AI call: the service checks for the file (via `RepoReader`) before prompting. `FILE_EXISTS` from the writer remains the final guard against a race.

### 3. Failure handling reuses the scan's pattern: one retry with the problem fed back, then `needs_review`
There is no new failure pattern. Each requirement gets at most `INVALID_AI_OUTPUT_ATTEMPTS` (2, the constant the scan already uses) answers. The answer counts as invalid if any of these fails:
- the answer parses (structured `{title, code}`, zod-validated),
- the acceptance rule passes (`core/rules/generated-test.ts`: requirement comment, `expect(`, no forbidden calls, no absolute URLs, imports only from `@playwright/test`),
- the file compiles (`SpecChecker`).

The retry prompt includes the exact problems: rule violations or compiler errors with line numbers. After the last attempt, the test is **not written**. It is reported as `needs_review`, with the code and the problems kept in the `--out` result for a person to look at. AI errors follow the existing `aiErrorAction` rule (stop the run vs skip the item).

### 4. Port `SpecChecker` — compiles inside AutoAI; the target repo's TypeScript is never used or needed
`check(fileName, text)` → `{ errors: string[] }` (empty means it compiles).
- It is implemented in `adapters/playwright` with the TypeScript compiler API, **in memory, in AutoAI's own process**: AutoAI's bundled `typescript` and AutoAI's bundled `@playwright/test` type definitions, with strict settings, `noEmit`, and no reading of the target repo's `tsconfig.json` or `node_modules`.
- So the check does **not** assume the target repo has TypeScript, `tsc` or Playwright installed, and it behaves the same on every machine.
- What makes this sound: the acceptance rule only allows imports from `@playwright/test`, so a generated spec is self-contained and cannot depend on anything only the target repo has.
- What the target repo *does* need is Playwright, to *run* the tests later. Before writing, the service reads the target repo's `package.json` (via `RepoReader`) and adds a **notice** to the result when `@playwright/test` is not a dependency ("to run these tests, add @playwright/test and a playwright.config with baseURL"). A missing `package.json` gets the same notice. AutoAI never installs anything in the user's repo.
- Known limit: a target repo with unusual TypeScript settings could still reject a spec that passes this check. The M2 runner is where that surfaces; noted in BUILD-LOG, not solved here.

### 5. Dependencies
- Add `@playwright/test` (exact pin, 1.63.0) as a runtime dependency. M2's runner needs it; here only its type definitions are used.
- Move `typescript` from devDependencies to dependencies (same 5.9.3 pin), because the compiler API runs at runtime.
- Both are already in CLAUDE.md's stack. In `src/`, only `adapters/playwright` may import them (new deps rule + `deps:selftest` case).

### 6. What gets a test, and the CLI
- Only requirements with a **confirmed** `match` or `mismatch` finding (a core rule). A mismatch test asserts the spec, so it fails until the bug is fixed. `not_implemented` and `needs_review` findings get no test.
- One prompt per requirement: the requirement plus the same ranked, budgeted code the scan uses, including templates such as `index.html` for selectors.
- `npm run generate-tests -- --repo <dir> --from <scan-result.json> [--out] [--model] [--effort]` reuses a saved `npm run scan --out` result (zod-validated at the boundary), so matching is never paid for twice.

## Consequences
- Two new ports and their adapters, each contract-tested.
- The runtime install is bigger (`@playwright/test`, `typescript`); the desktop app needs Playwright for M2 regardless.
- A test that doesn't compile, or that would overwrite a user's file, is never written into the user's repo.
- Generated tests use relative `page.goto("/...")`. They run only once the user's repo has Playwright and a `baseURL`, which is flagged when missing and handled by the M2 runner.

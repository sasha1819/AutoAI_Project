# ADR 0005 — Running a test: the `TestRunner` port and the Playwright adapter

Status: accepted (user, 2026-09-29)

## Context
M2: run one generated test and report what happened, step by step, with a capture on failure (PRD Flow 4 steps 14–16; reliability-rules). ARCHITECTURE §3 names a `TestRunner` port ("run a spec, emit step events") but no shape. The retry decision already exists as a pure rule (`core/rules/run-status.ts`, `decideRun`). This ADR fixes the port, how Playwright is started, and what is captured. No new npm dependency.

## Decision

### 1. The port runs ONE attempt; the retry loop is not in the adapter
```ts
runAttempt(request: { repoRoot; specPath; runId; attempt }, onStep: (event: StepEvent) => void)
  → Promise<Result<AttemptReport, TestRunError>>
AttemptReport = { result: AttemptResult; durationMs; steps: StepEvent[]; failure?: FailureCapture }
FailureCapture = { step; error; screenshotPath?; pageSnapshot? }
```
- The `RunTest` service (next task) calls `runAttempt`, asks `decideRun`, and calls again only on `retry`. Playwright's own `retries` is forced to 0, so it can never retry silently behind the rule's back.
- Each attempt is a fresh Playwright process: the same conditions (new browser, new server start) and no state carried over.

### 2. Typed step events live in `core/domain/step.ts`
`StepEvent = { runId, attempt, step, status: "running" | "passed" | "failed", durationMs, ts }` (zod), as in reliability-rules §6 plus `attempt`, so both attempts' logs stay apart.
- They are streamed through `onStep` as they happen (for the live log), and also returned in the report.
- Steps are Playwright actions, `expect` calls and `test.step` blocks. Fixtures and hooks are left out.

### 3. Whose Playwright: the target repo's own, with AutoAI's settings on top
- A spec imports `@playwright/test`, which resolves from the user's repo. Loading AutoAI's copy too makes Playwright fail. So the adapter runs `<repo>/node_modules/@playwright/test/cli.js` with Node, with `cwd` = the repo. It never uses `npx`, which could download things.
- It passes a small **wrapper config** written into AutoAI's own temp folder, never into the user's repo:
  - It loads the user's `playwright.config.*`, for `baseURL`, `webServer` and so on.
  - It overrides: `retries: 0`, `workers: 1`, Chromium only, `screenshot: "only-on-failure"`, `outputDir` = AutoAI's artifacts folder, and the AutoAI reporter only.
  - Paths the user's config left relative (`webServer.cwd`, `testDir`) are pinned to the repo, so moving the config doesn't change behaviour.
  - A wrapper is needed because the CLI has no flag for screenshots.
- It runs only specs inside `tests/autoai/`, the same confinement as `TestWriter`. A symlink, a `..` path or another folder is refused.

### 4. AutoAI's reporter: a small plain-JS file inside the user's Playwright process
- `adapters/playwright/autoai-reporter.mjs` writes one JSON line per step start/end and per test end to stdout, each with an `AUTOAI:` prefix. It imports nothing, so any recent Playwright can load it.
- The adapter parses only prefixed lines and zod-validates them. Everything else on stdout (the user's `console.log`, Playwright's own output) is ignored.

### 5. Outcome mapping (as noted in BUILD-LOG) and error codes
- `passed` → `passed`.
- `failed` and `timedOut` → `failed`.
- `interrupted`, a crash, no test found, or no result → a typed error, **never an attempt**.
- `skipped` → error `TEST_SKIPPED`, because a generated test must not skip; the acceptance rule already bans it.
- Codes: `REPO_NOT_FOUND`, `PATH_NOT_ALLOWED`, `SPEC_NOT_FOUND`, `PLAYWRIGHT_NOT_INSTALLED` (with "add @playwright/test"), `PLAYWRIGHT_CONFIG_MISSING`, `BROWSER_NOT_INSTALLED` (with "npx playwright install chromium"), `TEST_SKIPPED`, `RUN_INTERRUPTED`, `RUN_CRASHED`.
- AutoAI never installs anything in the user's repo or on their machine.

### 6. What is captured on failure (no AI)
- **The step:** the failing step's title.
- **The error:** Playwright's error message and call log, with the terminal colour codes stripped.
- **The screenshot:** its path in AutoAI's artifacts folder.
- **The page snapshot:** Playwright's `error-context` attachment, a text snapshot of the page. This is the "DOM state" from PRD Flow 4, and it is optional because older Playwright versions don't produce it.
- Screenshots and snapshots stay local, in a folder the composition root passes in (CLI: `--artifacts`, default the OS temp folder). Nothing is sent anywhere by this adapter.

### 7. Boundaries and tests
- `adapters/playwright` may use `node:child_process` and `node:fs`. No other layer spawns processes (a new `deps` rule and a selftest case).
- The contract tests are real: temp repos with Chromium against a tiny local HTML page, covering these cases:
  - pass, fail and timeout;
  - a failure with a screenshot and a snapshot;
  - a spec outside `tests/autoai`;
  - a missing Playwright, a missing config and a skipped test;
  - `retries` in the user's config being ignored;
  - the user's `console.log` noise not breaking the parsing.
- A fake `TestRunner` (scripted attempts) goes in `services/testing/` for the service task.

## Consequences
- The test suite now needs Chromium installed (`npx playwright install chromium`, already present here) and is a few seconds slower. There is no silent skip: a missing browser fails with `BROWSER_NOT_INSTALLED`.
- The user's repo needs `@playwright/test` and a `playwright.config` with `baseURL`/`webServer`, which is what generate-tests already warns about. The fixture sample repo gets both so M2 can be demoed end to end.
- Running a test executes the user's own code (their config and server), as any test runner does. AutoAI only starts it on the user's request.
- Old or unusual Playwright versions may lack the page snapshot or reporter fields. These degrade to "not captured", never to a wrong status.

## Clarifications (2026-09-29, after review; no change to the decisions)
- `FailureCapture.step` is `null` when the failure happened outside any step (e.g. a timeout between steps).
- The page snapshot is only the snapshot part of Playwright's `error-context` file (its YAML blocks). The rest of that file is Playwright's instructions for an AI and the test source, which are not page state.
- AutoAI's own `ANTHROPIC_*` environment variables are removed before Playwright starts, so the user's config, server and tests never see the key (PRD §19).
- If Playwright cannot be started at all, the result is `RUN_CRASHED`, not a thrown error.

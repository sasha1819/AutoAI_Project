---
name: reliability-rules
description: The rules that make AutoAI test results trustworthy — retry before blaming, flaky vs failed, AI only explains, confidence thresholds. Use whenever working on run statuses, the Playwright adapter, failure diagnosis, flaky detection, or anything that decides pass/fail.
---

# Reliability rules

Location: decisions in `core/rules/run-status.ts` (pure, table-tested). Execution in `adapters/playwright/` behind the `TestRunner` port. Flow in `services/run-test.ts` and `services/diagnose-failure.ts`.

1. Pass/fail is decided by Playwright, never by an AI model.
2. On a failed step, capture first (screenshot, error text, DOM snippet, step name). No AI yet.
3. Retry the failed test once, same conditions.
   - Passes on retry => `flaky` (record both attempts). Not sent to diagnosis as a bug.
   - Fails again => `failed`.
4. Only a confirmed `failed` goes to diagnosis. Send: step description, error, screenshot, relevant source snippet.
5. Diagnosis output (zod): `explanation`, `likelyCause`, `suggestedFix?`, `confidence`. Confidence < 0.7 => shown as "possible cause".
6. Step events are typed JSON lines `{ runId, step, status, durationMs, ts }`, defined in `core/domain`, streamed through the port.
7. Never hide flakiness by re-running silently until green.

RunStatus: `passed | failed | flaky | not_run`.

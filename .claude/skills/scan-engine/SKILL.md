---
name: scan-engine
description: How AutoAI's scan logic is built across the layers — PRD parsing, repo relevance picking, requirement matching (spec-vs-code findings), prompts, output validation, test generation, fixtures. Use whenever the task touches requirements, findings, evidence, confidence, prompts sent to Claude, or the fixtures — even if the user only says "scan", "mismatch" or "generate tests".
---

# Scan logic (this is the core of the product)

Loads together with the `architecture` skill. Where each piece lives:

| Piece | Location | Notes |
| --- | --- | --- |
| Requirement/Finding/Evidence types | `core/domain/` | zod schemas + inferred types |
| PRD text -> requirements | `core/parsing/prd.ts` | pure text parsing, no AI |
| Which repo files matter for a requirement | `core/rules/relevance.ts` | pure keyword scoring over file paths and local file text |
| Prompt text for matching / test generation | `core/prompts/` | pure functions returning strings |
| Validate + normalise Claude's answer | `core/parsing/finding.ts` | zod; invalid => `INVALID_AI_OUTPUT` |
| Confidence policy (< 0.7 => needs_review, mismatch needs evidence) | `core/rules/confidence.ts` | table-tested |
| Reading the repo | `adapters/fs/` via `RepoReader` port | |
| Calling Claude | `adapters/claude/` via `AiProvider` port | retries, rate limits, token counting live here |
| The orchestration | `services/scan-project.ts`, `services/generate-tests.ts` | |
| CLI | `cli/scan.ts` -> `npm run scan -- --repo <p> --prds <p> --out <f>` | |

## Finding rules
- `type`: match | mismatch | not_implemented. `mismatch` REQUIRES evidence (file + lines + snippet), otherwise downgraded to needs_review.
- `confidence < 0.7` => `reviewStatus = needs_review`. Never shown as fact.
- `not_implemented` is not a bug; it is shown separately.
- Batch requirements per feature area first; hide batching behind one function so per-requirement mode can replace it.
- Send only relevant files; log approximate token counts; cap context.

## Fixtures = accuracy test
`fixtures/sample-repo`, `fixtures/sample-prds`, `fixtures/expected-findings.json` with planted mismatches. After any change to prompts, parsing or rules, run the `scan-evaluator` agent. Goal: every planted mismatch found, zero false positives.

## Test generation
See skill `playwright-generation`. Generated specs are written through the `RepoWriter`/fs adapter into the user's repo, never into AutoAI's own `src/`.

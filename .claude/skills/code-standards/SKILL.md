---
name: code-standards
description: AutoAI code quality bar — strict TypeScript, error handling with Result, zod at boundaries, testing approach, naming, commits. Use whenever writing or reviewing TypeScript in this project, and before marking any task done.
---

# Code standards

## TypeScript
- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. No `any`, no `as` casts to silence errors, no `!` (outside tests).
- Use discriminated unions for states (`{ type: "mismatch", evidence } | { type: "match" }`), and exhaustive `switch` with a `never` check.
- Branded ids. `readonly` data in core. Prefer pure functions and small modules.

## Errors
- Expected failure => `Result<T, { code: ErrorCode; message: string }>`. Codes are a closed union per use case.
- Unexpected/bug => throw. Never swallow errors. Never `catch` just to log and continue.
- Adapters translate library errors to codes at the boundary (`AI_RATE_LIMITED`, `REPO_NOT_FOUND`, `INVALID_AI_OUTPUT`).

## Boundaries
zod-parse everything from outside: AI responses, IPC payloads, files, env vars, DB rows. Inside the core, trust the types.

## Tests
- Core: table-driven, deterministic, no mocks needed. Name tests by behavior: "flags low-confidence findings as needs_review".
- Services: in-memory fake ports. Adapters: contract tests + recorded AI responses (no live API in normal test runs).
- A bug fix starts with a failing test.

## Naming and size
Domain words from ARCHITECTURE.md section 4. Functions do one thing; if you need "and" in the name, split. Files under ~200 lines.
Comments say why, not what. Delete dead code; do not comment it out.

## Commits
Conventional Commits: `feat(core): classify flaky runs`, `test(services): cover scan failure codes`. One task per commit.

## Before saying "done"
`npm run verify` is green, tests exist for new logic, nothing new violates `docs/ARCHITECTURE.md`.

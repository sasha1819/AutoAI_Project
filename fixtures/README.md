# Fixtures: the scan-accuracy test

- `sample-repo/`: a tiny, runnable shop (`npm start` inside it, or `node server.mjs`; `PORT` env, default 4173). Plain HTML + JS modules, no dependencies.
- `sample-prds/`: its spec, in two styles on purpose.
  - `shop.md`: clean markdown with tagged items ("Cart 1.2: ...").
  - `checkout.md`: written like a doc-editor export (title line, numbered sections, indented text, no `#` headings or tags). This is how `docs/PRD.md` is written, and today's parser extracts 0 requirements from it.
- `expected-findings.json`: the answer key. 3 planted mismatches, 2 correct features. Each entry is keyed by PRD location (`prd.file` + `prd.line`), cites evidence (file, lines, snippet) in `sample-repo`, and records whether today's parser extracts it.
  - `prd.line` is the line where the requirement starts: the tag line for a tagged item, the section heading line for a heading or numbered section (`checkout.md` line 5, "1. Placing an order", not the body on line 6). This matches `Requirement.source.line`.
  - `type` is lowercase `match` | `mismatch` | `not_implemented` (the scan-engine skill's spelling; the PRD's "Match/Mismatch/NotImplemented" table is a sketch). Every mismatch carries an expected `severity` (`high` | `medium` | `low`); the key for severity is a judgement, so grade it loosely.

Rules:
1. Nothing inside `sample-repo/` may hint at the answers (no "bug", "mismatch", requirement tags, TODOs). The scan engine reads that folder, and a hint would make the accuracy number meaningless.
2. After editing any fixture file, run `npm test`. `src/cli/fixtures.test.ts` checks that the key matches the PRDs, the parser and the cited lines. `fixtures/sample-repo.test.mjs` checks that the planted bugs are real and the correct features work.
3. Prettier formats `sample-repo`, so re-check the evidence line numbers after a format run (the test will tell you).

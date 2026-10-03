# ADR 0008 — AI-assisted requirement extraction for unstructured PRDs

Status: proposed (2026-10-03), waiting for the user's approval. Nothing here is built yet.

## Context
The PRD parser (`core/parsing/prd.ts`) is mechanical: it finds requirements under `#` headings and in tagged lines
("Cart 2.4: …"). A PRD written as plain prose, or exported from a doc editor with numbered sections and no `#`
headings, gives 0 requirements. Real PRDs look like this: `docs/PRD.md` itself and the fixture `checkout.md`
both give 0. Add project already says so plainly. This ADR proposes reading such files with Claude during the scan.

It adds a new AI call to the scan path, so it must keep the matcher's rules (CLAUDE.md rule 5, ADR 0002):
- the output is validated by zod;
- every claim is backed by evidence that is checked against the source text;
- a confidence below 0.7 means `needs_review`, never shown as fact.

## Decision (proposed)

### 1. When it runs
- **Only for a PRD file that the parser reads as 0 requirements.** Files the parser handles are not sent. A parsed
  requirement stays exact and free, and the AI never second-guesses a structured PRD.
- **Only during a scan (`scan:run`), with the user's key.** `project:read-prds` stays free and AI-free. Add project
  says in advance which files will be read by Claude, and roughly what that costs (see 5).
- **Never in mock mode with a real key.** The mock AiProvider answers extraction prompts with clearly marked mock items.

### 2. Where the pieces go (no new port, no new dependency)
| Piece | Location |
| --- | --- |
| Prompt text | `core/prompts/extraction.ts` (pure; the PRD text is escaped like the matcher's inputs) |
| Answer schema and validation | `core/parsing/extraction.ts` (zod; invalid → `INVALID_AI_OUTPUT`, one retry through `askUntilValid`) |
| Review decision | `core/rules/confidence.ts` (the same `CONFIDENCE_THRESHOLD = 0.7`) plus a new `reviewExtracted` beside `reviewFinding` |
| Evidence check | `core/rules/evidence.ts` `verifyEvidence`, reused: the quote must appear in the PRD within the cited lines ± 2 |
| Size cap | `core/rules/prompt-budget.ts` (a file over the budget is split by line ranges, never truncated silently) |
| Orchestration | `services/extract-requirements.ts` gains an optional AI step; `scanProject` calls it before matching |
| AI call | the existing `AiProvider.complete` port (`adapters/claude`), structured output |

### 3. What Claude returns, and what is checked
Per file: a list of items `{ area, title, text, quote, lines: [start, end], confidence }`.
- **Evidence:** `quote` must be a verbatim span of the PRD (whitespace-normalised, ≥ 8 characters, ≤ 30 lines),
  inside `lines` ± 2. These are the matcher's limits, reused.
- **Paraphrase:** `text` may restate the requirement plainly; `quote` is what proves it is in the spec.
- **Review status:**
  - an item with a verified quote and confidence ≥ 0.7 is `confirmed`;
  - otherwise it is `needs_review`, with reasons (`low_confidence`, `evidence_unverified`), exactly as findings.
- **No invention:** an item without a quote is invalid output (schema), not a low-confidence item.

### 4. Domain change
`Requirement` gains an origin, so screens and reports can tell them apart:
- `{ origin: "parsed" }`, as today;
- `{ origin: "extracted", confidence, reviewStatus, reasons, evidence }`.

The tag of an extracted item is `"<area> (AI) <n>"`, so it can never collide with a written tag. The source line is
the quote's first line.

### 5. Cost and consent
- One call per plain-prose file (or per part of a large one). A typical 2–5 page PRD is about 2–6k input tokens and
  1–2k output tokens at the default model (ADR 0002).
- Add project shows "N files are plain prose: during the scan Claude reads them to find requirements" before Scan.
- The scan report counts these calls and tokens in `usage`, like matching.

### 6. Progress and results
- `ScanProgress` gains `{ stage: "extracting", file, part, parts }` between `prds_read` and `reading_code`.
- Extracted requirements carry their review status into the Wow summary and the findings screen.

### 7. Accuracy
- The fixture `checkout.md` already holds a requirement in this style (`expected-findings.json`).
- The `scan-evaluator` agent measures it: every planted requirement found, zero invented ones (no unverified quote
  accepted as confirmed).
- Recorded replies (`fixtures/recorded`) keep the normal test runs offline.

## Open questions for the user
1. **Are `needs_review` extracted requirements matched against the code?**
   - Option A (proposed): yes. Their findings inherit `needs_review`, so nothing from an uncertain extraction is
     shown as fact.
   - Option B: no. They are listed for the user to confirm first, which needs a confirm action and screen work.
2. **Is extraction always on for plain-prose files, or a switch on Add project?**
   - Proposed: always on, since the cost is said before Scan.

## Consequences
- Plain-prose PRDs stop being a dead end, at a small, stated cost.
- One more prompt to keep accurate: it is covered by the scan-evaluator after any change.
- The parser stays the first choice. This is a fallback, not a replacement.

## Alternatives considered
- Smarter mechanical splitting (numbered sections, paragraphs): rejected in LATER (2026-09-28). It produces
  "requirements" that are just paragraphs, with no judgement of what is testable.
- Extracting every PRD with AI: costs more, and loses the exact, free parse of structured PRDs.
- A separate extraction step before the scan (its own button): one more step for the user, and no gain in safety,
  since the same rules apply.

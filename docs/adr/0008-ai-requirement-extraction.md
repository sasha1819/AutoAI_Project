# ADR 0008 — AI-assisted requirement extraction for unstructured PRDs

Status: accepted (user, 2026-10-03), with the user's answers to the open questions recorded in §3, §5 and §8.

## Context
The PRD parser (`core/parsing/prd.ts`) is mechanical: it finds requirements under `#` headings and in tagged lines
("Cart 2.4: …"). A PRD written as plain prose, or exported from a doc editor with numbered sections and no `#`
headings, gives 0 requirements. Real PRDs look like this: `docs/PRD.md` itself and the fixture `checkout.md`
both give 0. Add project already says so plainly. This ADR proposes reading such files with Claude during the scan.

It adds a new AI call to the scan path, so it must keep the matcher's rules (CLAUDE.md rule 5, ADR 0002):
- the output is validated by zod;
- every claim is backed by evidence that is checked against the source text;
- a confidence below 0.7 means `needs_review`, never shown as fact.

## Decision

### 1. When it runs
- **Only for a PRD file that the parser reads as 0 requirements.** Files the parser handles are not sent. A parsed
  requirement stays exact and free, and the AI never second-guesses a structured PRD.
- **Only during a scan (`scan:run`), with the user's key.** `project:read-prds` stays free and AI-free. Add project
  says in advance how many files Claude will read and how many extra calls that means (see 5).
- **Always on, no switch** (user decision): every PRD file that parses to 0 requirements is read by Claude, unless it
  is over the size cap (see 5).
- **Never in mock mode with a real key.** The mock AiProvider answers extraction prompts with clearly marked mock items.

### 2. Where the pieces go (no new port, no new dependency)
| Piece | Location |
| --- | --- |
| Prompt text | `core/prompts/extraction.ts` (pure; the PRD text is escaped like the matcher's inputs) |
| Answer schema and validation | `core/parsing/extraction.ts` (zod; invalid → `INVALID_AI_OUTPUT`, one retry through `askUntilValid`) |
| Review decision | `core/rules/extraction.ts` `judgeExtracted`, with the same `CONFIDENCE_THRESHOLD = 0.7` from `confidence.ts` |
| Evidence check | `core/rules/evidence.ts` `verifyEvidence`, reused: the quote must appear in the PRD within the cited lines ± 2 |
| Size cap and the three-way decision | `core/rules/extraction.ts` (a file over the cap is not sent; the user is told why) |
| Orchestration | `services/extract-with-ai.ts` (new); `scanProject` calls it before matching |
| AI call | the existing `AiProvider.complete` port (`adapters/claude`), structured output |

### 3. What Claude returns, and what is checked
Per file: a list of items `{ area, title, text, quote, lines: [start, end], confidence }`.
- **Evidence:** `quote` must be a verbatim span of the PRD (whitespace-normalised, ≥ 8 characters, ≤ 30 lines),
  inside `lines` ± 2. These are the matcher's limits, reused.
- **Paraphrase:** `text` may restate the requirement plainly; `quote` is what proves it is in the spec.
- **Three outcomes** (user decision):
  - **dropped:** the quote fails the verbatim check. The item is discarded completely: it is not shown and not
    compared (only counted).
  - **a requirement:** the quote is verified and confidence ≥ 0.7. It becomes a Requirement and is compared with the
    code like a parsed one.
  - **needs your review:** the quote is verified and confidence < 0.7. It is shown on the results as "found, not
    compared, needs your review" and is **never** sent to the matcher (a test proves it).
- **No invention:** an item without a quote is invalid output (schema), not a low-confidence item.

### 4. Domain change
- `Requirement` gains an optional `extraction: { confidence, quote }`, present only on a requirement Claude found, so
  screens and reports can tell them apart. Its tag is `"<area> (AI) <n>"`, so it can never collide with a written
  tag; its source line is the quote's first line.
- A new `RequirementCandidate` (area, text, source, quote, confidence) holds the "needs your review" items. The scan
  result lists them separately (`needsReview`); they are never Requirements, so the matcher cannot receive them.

### 5. Cost, consent and the size cap
- One call per plain-prose file (one more only if its answer is invalid, the shared retry policy). A typical 2–5
  page PRD is about 2–6k input tokens and 1–2k output tokens at the default model (ADR 0002).
- **Before Scan** (user decision), the note beside Scan on Add project says how many files Claude will read and how
  many extra calls that means. `project:read-prds` reports, per file, whether Claude will read it.
- **Size cap per file** (user decision): a file over `MAX_EXTRACTION_CHARS` is not sent. Add project names it and
  says why, with its size and the limit, and what to do (split it, or add headings so it parses without Claude); the
  scan reports it as a warning (`PRD_TOO_LARGE`). No file is split or cut silently.
- The scan report counts these calls and tokens in `usage`, like matching.

### 6. Progress and results
- `ScanProgress` gains `{ stage: "extracting", file, index, total }` and `{ stage: "extracted", requirements, needsReview }`
  between `prds_read` and `reading_code`.
- Extracted requirements carry their review status into the Wow summary and the findings screen.

### 7. Accuracy
- The fixture `checkout.md` already holds a requirement in this style (`expected-findings.json`).
- The `scan-evaluator` agent measures it: every planted requirement found, zero invented ones (no unverified quote
  accepted as confirmed).
- Real recorded answers (`fixtures/recorded/claude-extraction`, made by the user with `scripts/record-extractions.mjs`)
  are replayed offline, like the scan and diagnosis recordings: the prompt must match byte for byte and the real
  answer must still parse.

## 8. Answers to the open questions (user, 2026-10-03)
1. Needs-review extracted items are not compared (see §3, "needs your review"). Unverified quotes are dropped.
2. Extraction is always on for files that parse to 0 requirements, with no switch; the cost is said before Scan.

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

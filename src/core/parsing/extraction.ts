import { z } from "zod";
import { Confidence } from "../domain/confidence.ts";
import { Quote, type Requirement, type RequirementCandidate } from "../domain/requirement.ts";
import { ok, type Result } from "../domain/result.ts";
import type { ExtractionPrompt } from "../prompts/extraction.ts";
import { unescapeText } from "../prompts/escape.ts";
import { verifyEvidence } from "../rules/evidence.ts";
import { judgeExtracted } from "../rules/extraction.ts";
import { extractJson, type InvalidAiOutput, invalid } from "./json.ts";

/** What one extraction answer yields (ADR 0008): requirements to compare, items for review, and how many were dropped. */
export type ExtractionOutcome = {
  readonly requirements: readonly Requirement[];
  readonly needsReview: readonly RequirementCandidate[];
  readonly dropped: number;
};

const words = z
  .string()
  .transform((s) => s.replace(/\s+/g, " ").trim())
  .pipe(z.string().min(1));
// Strict where a wrong value would change the verdict (text, confidence) and on the quote being there at all (ADR
// 0008: an item without a quote is invalid output, so it is asked for again). Lenient on the quote's content: a wrong
// one fails the verbatim check, and the item is dropped.
const AiItem = z.object({
  area: words,
  text: words,
  quote: z.object({ lines: z.unknown(), snippet: z.string() }),
  confidence: Confidence,
});
const AiAnswer = z.object({ requirements: z.array(AiItem) });

/**
 * Validates Claude's answer to an extraction prompt and sorts each item by the ADR 0008 rule, with its quote checked
 * verbatim against exactly the PRD the prompt showed. Anything malformed is INVALID_AI_OUTPUT.
 */
export function parseExtractionResponse(
  raw: string,
  prompt: Pick<ExtractionPrompt, "file">,
  /** Claude's requirements already numbered per area in this scan, so tags stay unique across files. */
  numbered: ReadonlyMap<string, number> = new Map(),
): Result<ExtractionOutcome, InvalidAiOutput> {
  const json = extractJson(raw);
  if (!json.ok) return json;
  const parsed = AiAnswer.safeParse(json.value);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return invalid(`the answer does not match the extraction shape (${issues})`);
  }

  const { path, text } = prompt.file;
  const files = new Map([[path, text]]);
  const requirements: Requirement[] = [];
  const needsReview: RequirementCandidate[] = [];
  const perArea = new Map(numbered);
  let dropped = 0;
  for (const item of parsed.data.requirements) {
    const claimed = Quote.safeParse({ ...item.quote, snippet: unescapeText(item.quote.snippet) });
    const quote = claimed.success ? claimed.data : null;
    const verdict = judgeExtracted({
      quoteVerified: quote !== null && verifyEvidence({ file: path, ...quote }, files),
      confidence: item.confidence,
    });
    if (verdict === "dropped" || quote === null) {
      dropped += 1;
      continue;
    }
    const source = { file: path, line: quote.lines[0] };
    if (verdict === "needs_review") {
      needsReview.push({
        area: item.area,
        text: item.text,
        source,
        quote,
        confidence: item.confidence,
      });
      continue;
    }
    const n = (perArea.get(item.area) ?? 0) + 1;
    perArea.set(item.area, n);
    requirements.push({
      tag: `${item.area} (AI) ${String(n)}`,
      area: item.area,
      text: item.text,
      source,
      extraction: { confidence: item.confidence, quote },
    });
  }
  return ok({ requirements, needsReview, dropped });
}

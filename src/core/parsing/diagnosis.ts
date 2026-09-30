import { z } from "zod";
import { type DiagnosisAnswer, LikelyCause } from "../domain/diagnosis.ts";
import { Confidence } from "../domain/finding.ts";
import { ok, type Result } from "../domain/result.ts";
import { extractJson, type InvalidAiOutput, invalid } from "./json.ts";

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

// Strict where a wrong value would mislead (cause, confidence); a blank or missing fix simply means none.
const Answer = z.object({
  explanation: z.string().transform(tidy).pipe(z.string().min(1)),
  likelyCause: LikelyCause,
  suggestedFix: z
    .string()
    .nullish()
    .transform((s) => (s === null || s === undefined || s.trim() === "" ? null : s.trim())),
  confidence: Confidence,
});

/** Validates Claude's answer to a diagnosis prompt. Anything malformed is INVALID_AI_OUTPUT. */
export function parseDiagnosisResponse(raw: string): Result<DiagnosisAnswer, InvalidAiOutput> {
  const json = extractJson(raw);
  if (!json.ok) return json;
  const parsed = Answer.safeParse(json.value);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return invalid(`the answer does not match the diagnosis shape (${issues})`);
  }
  return ok(parsed.data);
}

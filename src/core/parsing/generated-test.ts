import { z } from "zod";
import { ok, type Result } from "../domain/result.ts";
import { extractJson, type InvalidAiOutput, invalid } from "./json.ts";

export type GeneratedTest = { readonly title: string; readonly code: string };

const Answer = z.object({
  title: z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1)),
  // The code is kept byte for byte; it is judged by the acceptance rule and the compiler, not reformatted.
  code: z.string().refine((s) => s.trim() !== "", "code must not be blank"),
});

/** Validates Claude's answer to a test-generation prompt. Anything malformed is INVALID_AI_OUTPUT. */
export function parseGeneratedTest(raw: string): Result<GeneratedTest, InvalidAiOutput> {
  const json = extractJson(raw);
  if (!json.ok) return json;
  const parsed = Answer.safeParse(json.value);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return invalid(`the answer does not match {title, code} (${issues})`);
  }
  return ok(parsed.data);
}

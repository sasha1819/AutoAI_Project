import type { DomainError } from "../domain/domain-error.ts";
import { err, ok, type Result } from "../domain/result.ts";

export type InvalidAiOutput = DomainError<"INVALID_AI_OUTPUT">;

// Claude sometimes wraps the object in prose or a ```json fence. A fence wins, so braces in the prose around it
// cannot corrupt the object; otherwise take the outermost {...}.
const FENCE = /```(?:json)?\s*\n([\s\S]*?)\n\s*```/;

/** The JSON object in a model's answer, unvalidated; the caller's zod schema decides whether it is usable. */
export function extractJson(raw: string): Result<unknown, InvalidAiOutput> {
  const body = FENCE.exec(raw)?.[1] ?? raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end < start) return invalid("no JSON object in the answer");
  try {
    const value: unknown = JSON.parse(body.slice(start, end + 1));
    return ok(value);
  } catch (e) {
    return invalid(`the answer is not valid JSON (${e instanceof Error ? e.message : String(e)})`);
  }
}

/** An INVALID_AI_OUTPUT failure with the given reason. */
export function invalid(message: string): { readonly ok: false; readonly error: InvalidAiOutput } {
  return err({ code: "INVALID_AI_OUTPUT", message });
}

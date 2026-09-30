import { describe, expect, it } from "vitest";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDiagnosisResponse } from "./diagnosis.ts";

/** Claude's real answer text from fixtures/recorded/claude-diagnosis. */
function recordedAnswer(name: string): string {
  const file = join(
    import.meta.dirname,
    "../../../fixtures/recorded/claude-diagnosis",
    `${name}-1.json`,
  );
  return z
    .object({ result: z.object({ value: z.object({ text: z.string() }) }) })
    .parse(JSON.parse(readFileSync(file, "utf8"))).result.value.text;
}

const answer = {
  explanation:
    "The test types save10 and expects no error,\n  but findDiscount only accepts SAVE10.",
  likelyCause: "app_bug",
  suggestedFix: "Upper-case the code in findDiscount before the lookup.",
  confidence: 0.92,
};

describe("parseDiagnosisResponse", () => {
  it.each([
    ["app-bug-cart-1-2", "app_bug", 0.95],
    ["test-bug-cart-1-1", "test_bug", 0.95],
    ["environment-account-3-1", "app_bug", 0.8],
  ])("accepts Claude's real answer for %s (%s, %d)", (name, cause, confidence) => {
    const result = parseDiagnosisResponse(recordedAnswer(name));
    expect(result.ok && result.value.likelyCause).toBe(cause);
    expect(result.ok && result.value.confidence).toBe(confidence);
    expect(result.ok && result.value.suggestedFix).toMatch(/\S/);
  });

  it("tidies whitespace in the explanation", () => {
    const result = parseDiagnosisResponse(JSON.stringify(answer));
    expect(result.ok && result.value.explanation).toBe(
      "The test types save10 and expects no error, but findDiscount only accepts SAVE10.",
    );
  });

  it("accepts an answer in a json fence, and a blank or missing fix as none", () => {
    const fenced = parseDiagnosisResponse(
      "Here you go:\n```json\n" + JSON.stringify({ ...answer, suggestedFix: "  " }) + "\n```",
    );
    expect(fenced.ok && fenced.value.suggestedFix).toBeNull();
    const missing = parseDiagnosisResponse(JSON.stringify({ ...answer, suggestedFix: undefined }));
    expect(missing.ok && missing.value.suggestedFix).toBeNull();
  });

  it.each([
    ["no JSON", "I think the app is broken."],
    ["an unknown cause", JSON.stringify({ ...answer, likelyCause: "gremlins" })],
    ["a confidence above 1", JSON.stringify({ ...answer, confidence: 1.5 })],
    ["a confidence as text", JSON.stringify({ ...answer, confidence: "high" })],
    ["a blank explanation", JSON.stringify({ ...answer, explanation: "  " })],
    ["a missing cause", JSON.stringify({ explanation: "x", confidence: 0.5 })],
  ])("rejects %s as INVALID_AI_OUTPUT", (_name, raw) => {
    const result = parseDiagnosisResponse(raw);
    expect(result.ok || result.error.code).toBe("INVALID_AI_OUTPUT");
  });
});

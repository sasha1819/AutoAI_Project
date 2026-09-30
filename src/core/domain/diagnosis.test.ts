import { describe, expect, it } from "vitest";
import { Diagnosis, LikelyCause } from "./diagnosis.ts";

describe("Diagnosis", () => {
  it("names where the fault most likely is", () => {
    expect(LikelyCause.options).toStrictEqual(["app_bug", "test_bug", "environment", "unclear"]);
  });

  const diagnosis = {
    explanation: "The discount field rejects lower-case codes.",
    likelyCause: "app_bug",
    suggestedFix: "Compare codes case-insensitively in findDiscount.",
    confidence: 0.9,
    reviewStatus: "confirmed",
    notes: [],
  };

  it("accepts a reviewed diagnosis, with or without a suggested fix", () => {
    expect(Diagnosis.parse(diagnosis)).toStrictEqual(diagnosis);
    expect(Diagnosis.parse({ ...diagnosis, suggestedFix: null }).suggestedFix).toBeNull();
  });

  it.each([
    ["an empty explanation", { explanation: "" }],
    ["an unknown cause", { likelyCause: "cosmic_rays" }],
    ["a confidence above 1", { confidence: 1.2 }],
  ])("rejects %s", (_name, change) => {
    expect(Diagnosis.safeParse({ ...diagnosis, ...change }).success).toBe(false);
  });
});

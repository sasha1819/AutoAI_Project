import { describe, expect, it } from "vitest";
import type { Requirement } from "../domain/requirement.ts";
import type { AiErrorCode } from "../ports/ai-provider.ts";
import { aiErrorAction, batchRequirements, INVALID_AI_OUTPUT_ATTEMPTS } from "./batching.ts";

const req = (tag: string, area: string, line: number): Requirement => ({
  tag,
  area,
  text: `${tag} text`,
  source: { file: "prd.md", line },
});

describe("batchRequirements", () => {
  it("groups requirements by area, areas in order of first appearance, requirements in PRD order", () => {
    const reqs = [
      req("Cart 1.1", "Cart", 1),
      req("Shipping 2.1", "Shipping", 5),
      req("Cart 1.2", "Cart", 2),
      req("Account 3.1", "Account", 9),
    ];
    expect(batchRequirements(reqs).map((b) => b.map((r) => r.tag))).toStrictEqual([
      ["Cart 1.1", "Cart 1.2"],
      ["Shipping 2.1"],
      ["Account 3.1"],
    ]);
  });

  it("returns no batches for no requirements", () => {
    expect(batchRequirements([])).toStrictEqual([]);
  });
});

describe("INVALID_AI_OUTPUT_ATTEMPTS", () => {
  it("allows one retry of an answer that failed validation", () => {
    expect(INVALID_AI_OUTPUT_ATTEMPTS).toBe(2);
  });
});

describe("aiErrorAction", () => {
  it.each<[AiErrorCode | "INVALID_AI_OUTPUT", "stop_scan" | "skip_batch"]>([
    // An answer that stayed invalid after the retry concerns one prompt only.
    ["INVALID_AI_OUTPUT", "skip_batch"],
    ["AI_AUTH_FAILED", "stop_scan"],
    ["AI_MODEL_NOT_FOUND", "stop_scan"],
    ["AI_RATE_LIMITED", "stop_scan"],
    ["AI_UNAVAILABLE", "stop_scan"],
    ["AI_OUTPUT_TRUNCATED", "skip_batch"],
    ["AI_REFUSED", "skip_batch"],
    ["AI_BAD_REQUEST", "skip_batch"],
  ])("%s -> %s", (code, action) => {
    expect(aiErrorAction(code)).toBe(action);
  });
});

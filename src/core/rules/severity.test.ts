import { describe, expect, it } from "vitest";
import type { FindingType, Severity } from "../domain/finding.ts";
import { findingSeverity } from "./severity.ts";

describe("findingSeverity", () => {
  it.each<[FindingType, Severity | null, Severity | null]>([
    ["mismatch", "high", "high"],
    ["mismatch", "low", "low"],
    ["mismatch", null, null],
    ["match", "high", null],
    ["not_implemented", "high", null],
  ])("%s claimed %s -> %s", (type, claimed, expected) => {
    expect(findingSeverity(type, claimed)).toBe(expected);
  });
});

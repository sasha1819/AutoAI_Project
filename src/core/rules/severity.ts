import type { FindingType, Severity } from "../domain/finding.ts";

/**
 * The severity a finding keeps. A mismatch and a missing feature both get one, on the same scale, so they can be
 * prioritised together; a match has nothing to rank.
 */
export function findingSeverity(type: FindingType, claimed: Severity | null): Severity | null {
  return type === "match" ? null : claimed;
}

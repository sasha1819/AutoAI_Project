import type { FindingType, Severity } from "../domain/finding.ts";

/** The severity a finding keeps: only a mismatch has one; for a match or a missing feature it is dropped. */
export function findingSeverity(type: FindingType, claimed: Severity | null): Severity | null {
  return type === "mismatch" ? claimed : null;
}

import type { Evidence } from "../domain/finding.ts";
import { splitLines, stripLineNumbers } from "../domain/repo-file.ts";

/** How many lines the cited range may be off by; models often miscount by a line or two. */
export const EVIDENCE_LINE_TOLERANCE = 2;
/** A shorter snippet ("}", "return") would match almost anywhere and prove nothing. */
export const MIN_SNIPPET_CHARS = 8;
/** Citing half a file is not pointing at the problem. */
export const MAX_EVIDENCE_SPAN_LINES = 30;

/** True when the snippet really appears in the cited file, within the cited lines (± tolerance). */
export function verifyEvidence(evidence: Evidence, files: ReadonlyMap<string, string>): boolean {
  const text = files.get(evidence.file);
  if (text === undefined) return false;
  const snippet = normalize(stripLineNumbers(evidence.snippet));
  if (snippet.replace(/\s/g, "").length < MIN_SNIPPET_CHARS) return false;
  const [start, end] = evidence.lines;
  if (end - start + 1 > MAX_EVIDENCE_SPAN_LINES) return false;
  const window = splitLines(text)
    .slice(Math.max(0, start - 1 - EVIDENCE_LINE_TOLERANCE), end + EVIDENCE_LINE_TOLERANCE)
    .join("\n");
  return normalize(window).includes(snippet);
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

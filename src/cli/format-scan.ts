import type { Finding, ReviewReason } from "../core/domain/finding.ts";
import type { Requirement } from "../core/domain/requirement.ts";
import type { ScanResult } from "../services/scan-project.ts";
import { aiUsageLine, stoppedLine } from "./format-ai.ts";

/** Terminal view of a scan: problems first (mismatches, missing features, items to review), then the rest. */
export function formatScan(scan: ScanResult, costUsd: number | null): string {
  const model = scan.models.length > 0 ? ` (${scan.models.join(", ")})` : "";
  const header = `Scanned ${String(scan.requirements.length)} requirements from ${String(scan.prdFiles.length)} PRD files against ${String(scan.sourceFiles)} source files${model}`;
  const confirmed = (type: Finding["type"]) =>
    scan.findings.filter((f) => f.reviewStatus === "confirmed" && f.type === type);
  const review = scan.findings.filter((f) => f.reviewStatus === "needs_review");

  const sections = [
    section(
      "Mismatches",
      confirmed("mismatch").map(
        (f) => `  ${sev(f)}${f.requirement.tag}  ${f.explanation}  (${where(f)})`,
      ),
    ),
    section(
      "Not implemented",
      confirmed("not_implemented").map(
        (f) => `  ${sev(f)}${f.requirement.tag}  ${f.explanation}  (${where(f)})`,
      ),
    ),
    section(
      "Needs review",
      review.map(
        (f) =>
          `  ${sev(f)}${f.type} ${f.requirement.tag}  ${f.explanation}  (${where(f)})  - ${reasons(f)}`,
      ),
    ),
    section(
      "Matches",
      confirmed("match").map((f) => `  ${f.requirement.tag}  (${source(f.requirement)})`),
    ),
    section(
      "Found by Claude, not compared, needs your review",
      scan.needsReview.map(
        (c) =>
          `  ${c.area}: ${c.text}  (${c.source.file}:${String(c.source.line)}, confidence ${c.confidence.toFixed(2)})`,
      ),
    ),
    section(
      "Not scanned",
      scan.notScanned.map((r) => `  ${r.tag}  (${source(r)})`),
    ),
    scan.warnings.length > 0
      ? ["Warnings", ...scan.warnings.map((w) => `  ${w.code}: ${w.message}`)].join("\n")
      : "",
    scan.stoppedBy ? stoppedLine(scan.stoppedBy) : "",
    aiUsageLine(scan.usage, costUsd),
  ];
  return [header, ...sections.filter((s) => s !== "")].join("\n\n");
}

function section(title: string, lines: readonly string[]): string {
  return lines.length === 0 ? "" : [`${title} (${String(lines.length)})`, ...lines].join("\n");
}

function sev(f: Finding): string {
  return f.severity ? `[${f.severity}] ` : "";
}

function source(r: Requirement): string {
  return `${r.source.file}:${String(r.source.line)}`;
}

function where(f: Finding): string {
  return f.evidence
    ? `${source(f.requirement)} -> ${f.evidence.file}:${String(f.evidence.lines[0])}`
    : source(f.requirement);
}

const REASON: Record<ReviewReason, (f: Finding) => string> = {
  LOW_CONFIDENCE: (f) => `low confidence (${f.confidence.toFixed(2)})`,
  MISSING_EVIDENCE: () => "no code cited",
  UNVERIFIED_EVIDENCE: () => "cited code not found in the file",
};

function reasons(f: Finding): string {
  return f.reviewReasons.map((r) => REASON[r](f)).join(", ");
}

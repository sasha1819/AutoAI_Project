import type { Finding, ReviewReason } from "../core/domain/finding.ts";
import type { Requirement } from "../core/domain/requirement.ts";
import type { AiErrorCode } from "../core/ports/ai-provider.ts";
import type { ScanResult } from "../services/scan-project.ts";

// Terminal-only advice; the adapter's messages stay neutral because the desktop app shows them too.
const HINT: Partial<Record<AiErrorCode, string>> = {
  AI_AUTH_FAILED: "Check ANTHROPIC_API_KEY.",
  AI_MODEL_NOT_FOUND: "Pass another with --model or AUTOAI_MODEL.",
  AI_OUTPUT_TRUNCATED: "Try --effort medium, which leaves more room for the answer.",
};

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
      "Not scanned",
      scan.notScanned.map((r) => `  ${r.tag}  (${source(r)})`),
    ),
    scan.warnings.length > 0
      ? ["Warnings", ...scan.warnings.map((w) => `  ${w.code}: ${w.message}`)].join("\n")
      : "",
    scan.stoppedBy ? stopped(scan.stoppedBy.code, scan.stoppedBy.message) : "",
    aiLine(scan, costUsd),
  ];
  return [header, ...sections.filter((s) => s !== "")].join("\n\n");
}

function stopped(code: AiErrorCode, message: string): string {
  const hint = HINT[code];
  return `Stopped early: ${code} - ${message}${hint === undefined ? "" : ` ${hint}`}`;
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

function aiLine(scan: ScanResult, costUsd: number | null): string {
  const { aiCalls, inputTokens, outputTokens } = scan.usage;
  if (aiCalls === 0) return "AI: 0 calls";
  const tokens = `${inputTokens.toLocaleString("en-US")} input + ${outputTokens.toLocaleString("en-US")} output tokens`;
  const cost = costUsd === null ? "" : `, about $${costUsd.toFixed(2)}`;
  return `AI: ${String(aiCalls)} calls, ${tokens}${cost}`;
}

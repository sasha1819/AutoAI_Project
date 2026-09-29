import type { GeneratedTestOutcome, GenerateTestsResult } from "../services/generate-tests.ts";
import { aiUsageLine, stoppedLine } from "./format-ai.ts";

/** Terminal view of a test-generation run: what was written, kept, held back for review, and why. */
export function formatGenerate(result: GenerateTestsResult, costUsd: number | null): string {
  const total = result.tests.length + result.skippedFindings;
  const model = result.models.length > 0 ? ` (${result.models.join(", ")})` : "";
  const header = `Generated tests for ${String(result.tests.length)} of ${String(total)} findings${model}`;
  const by = (status: GeneratedTestOutcome["status"]) =>
    result.tests.filter((t) => t.status === status);
  const line = (t: GeneratedTestOutcome, detail: string) =>
    `  tests/autoai/${t.fileName}  ${t.requirement.tag}  ${detail}`;

  const sections = [
    result.tests.length === 0
      ? "Only confirmed matches and mismatches get a test; the others were skipped."
      : "",
    section(
      "Written",
      by("written").map((t) => line(t, t.title ?? "")),
    ),
    section(
      "Already exists, left untouched",
      by("exists").map((t) => line(t, "delete it to regenerate")),
    ),
    section(
      "Needs review, not written",
      by("needs_review").map((t) => line(t, firstProblem(t))),
    ),
    section(
      "Not generated",
      by("not_generated").map((t) => line(t, firstProblem(t))),
    ),
    list("Notices", result.notices),
    list(
      "Warnings",
      result.warnings.map((w) => `${w.code}: ${w.message}`),
    ),
    result.stoppedBy ? stoppedLine(result.stoppedBy) : "",
    aiUsageLine(result.usage, costUsd),
  ];
  return [header, ...sections.filter((s) => s !== "")].join("\n\n");
}

function firstProblem(t: GeneratedTestOutcome): string {
  const [first = "", ...rest] = t.problems ?? [];
  return rest.length === 0 ? first : `${first}  (+${String(rest.length)} more problems)`;
}

function section(title: string, lines: readonly string[]): string {
  return lines.length === 0 ? "" : [`${title} (${String(lines.length)})`, ...lines].join("\n");
}

function list(title: string, items: readonly string[]): string {
  return items.length === 0 ? "" : [title, ...items.map((i) => `  ${i}`)].join("\n");
}

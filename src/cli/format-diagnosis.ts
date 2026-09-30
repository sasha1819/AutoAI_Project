import type { LikelyCause } from "../core/domain/diagnosis.ts";
import type { DiagnoseFailureResult } from "../services/diagnose-failure.ts";
import { aiUsageLine } from "./format-ai.ts";

const CAUSE: Record<LikelyCause, string> = {
  app_bug: "App bug: the app does not do what the test checks",
  test_bug: "Test bug: the test itself is wrong",
  environment: "Environment: server, setup or configuration",
  unclear: "Unclear from what was captured",
};

/** Terminal view of a diagnosis. Below the confidence bar it is labelled a possible cause, never a fact. */
export function formatDiagnosis(result: DiagnoseFailureResult, costUsd: number | null): string {
  const d = result.diagnosis;
  const confidence = d.confidence.toFixed(2);
  const head =
    d.reviewStatus === "confirmed"
      ? `Likely cause: ${CAUSE[d.likelyCause]} (confidence ${confidence})`
      : `Possible cause, not confirmed: ${CAUSE[d.likelyCause]} (confidence ${confidence})`;
  const sections = [
    `${result.specPath}: diagnosis of a confirmed failure (run ${result.runId})`,
    head,
    d.explanation,
    d.suggestedFix === null
      ? ""
      : `Suggested fix:\n${d.suggestedFix
          .split("\n")
          .map((l) => `  ${l}`)
          .join("\n")}`,
    ...d.notes.map((n) => `Note: ${n}`),
    result.redactions === 0
      ? ""
      : `Privacy: ${String(result.redactions)} ${result.redactions === 1 ? "value was" : "values were"} hidden before anything was sent to the AI.`,
    aiUsageLine(result.usage, costUsd),
  ];
  return sections.filter((s) => s !== "").join("\n\n");
}

import type { Diagnosis } from "../core/domain/diagnosis.ts";
import type { DomainError } from "../core/domain/domain-error.ts";
import type { Finding } from "../core/domain/finding.ts";
import { err, ok, type Result } from "../core/domain/result.ts";
import type { AttemptReport, Run } from "../core/domain/run.ts";
import { parseDiagnosisResponse } from "../core/parsing/diagnosis.ts";
import type { AiErrorCode, AiProvider, AiUsage } from "../core/ports/ai-provider.ts";
import type { RepoReadErrorCode, RepoReader } from "../core/ports/repo-reader.ts";
import { buildDiagnosisPrompt, type DiagnosisPromptInput } from "../core/prompts/diagnosis.ts";
import { reviewDiagnosis } from "../core/rules/diagnosis.ts";
import { requirementTagOf } from "../core/rules/generated-test.ts";
import { fitFilesToBudget } from "../core/rules/prompt-budget.ts";
import { redactSecrets, type RedactedText } from "../core/rules/redaction.ts";
import { indexFiles, rankRelevantFiles } from "../core/rules/relevance.ts";
import { settledStatus, shouldDiagnose } from "../core/rules/run-status.ts";
import { askUntilValid, newAiTally, usageOf } from "./ask-ai.ts";
import { loadSourceFiles } from "./source-files.ts";

export type DiagnoseFailureInput = {
  readonly run: Run;
  /** Findings of a saved scan, if any: they tell the diagnosis what the test checks and which code matters. */
  readonly findings: readonly Finding[];
};
export type DiagnoseFailureResult = {
  readonly runId: Run["runId"];
  readonly specPath: string;
  readonly diagnosis: Diagnosis;
  /** How many values were hidden before anything was sent to the AI provider. */
  readonly redactions: number;
  readonly model: string;
  readonly usage: { readonly aiCalls: number } & AiUsage;
};
export type DiagnoseFailureError = DomainError<
  | "INCONSISTENT_RUN"
  | "NOT_A_CONFIRMED_FAILURE"
  | "INVALID_AI_OUTPUT"
  | RepoReadErrorCode
  | AiErrorCode
>;
type Deps = { readonly repoReader: RepoReader; readonly aiProvider: AiProvider };
type FailedAttempt = Extract<AttemptReport, { result: "failed" }>;
/** Redacts one text and counts what it hid. */
type Redact = (text: string) => RedactedText;

/**
 * Explains a confirmed test failure with the AI (reliability-rules §4-5). Only a run the run-status rule marks
 * failed is sent; everything taken from the run, the repo, the PRD and the scan is redacted before the prompt is
 * built. The AI explains; it never changes the run's status.
 */
export async function diagnoseFailure(
  deps: Deps,
  input: DiagnoseFailureInput,
): Promise<Result<DiagnoseFailureResult, DiagnoseFailureError>> {
  const { run } = input;
  const failed = confirmedFailure(run);
  if (!failed.ok) return failed;

  const spec = await deps.repoReader.readText(run.repoRoot, run.specPath);
  if (!spec.ok) return spec;
  const tag = requirementTagOf(spec.value);
  const finding = input.findings.find((f) => f.requirement.tag === tag) ?? null;

  let redactions = 0;
  const redact: Redact = (text) => {
    const result = redactSecrets(text);
    redactions += result.count;
    return result.text;
  };
  const code =
    finding === null ? { files: [], omittedFiles: [] } : await appCode(deps, run, finding, redact);
  if ("error" in code) return err(code.error);
  const prompt = buildDiagnosisPrompt(
    promptInput(run, spec.value, failed.value, finding, code, redact),
  );

  const tally = newAiTally();
  const answer = await askUntilValid(
    deps.aiProvider,
    { system: prompt.system, user: prompt.user, jsonSchema: prompt.answerSchema },
    parseDiagnosisResponse,
    tally,
  );
  if (!answer.ok) return answer;
  return ok({
    runId: run.runId,
    specPath: run.specPath,
    diagnosis: reviewDiagnosis(answer.value.value, {
      skippedSetupProjects: failed.value.last.failure.skippedSetupProjects ?? [],
      findingType: finding?.type ?? null,
    }),
    redactions,
    model: answer.value.model,
    usage: usageOf(tally),
  });
}

/**
 * The run's failed attempts, when it is a confirmed failure. A saved run is a file the user passes in, so its
 * status is re-derived from its attempts by the rule instead of trusted.
 */
function confirmedFailure(
  run: Run,
): Result<{ readonly first: AttemptReport; readonly last: FailedAttempt }, DiagnoseFailureError> {
  if (settledStatus(run.attempts.map((a) => a.result)) !== run.status) {
    return err({
      code: "INCONSISTENT_RUN",
      message: `The saved run says ${run.status}, but its attempts do not add up to that. Run the test again.`,
    });
  }
  if (!shouldDiagnose(run.status)) {
    return err({
      code: "NOT_A_CONFIRMED_FAILURE",
      message: `The run is ${run.status}; only a failure that survived the retry is diagnosed.`,
    });
  }
  const [first] = run.attempts;
  const last = run.attempts.at(-1);
  // A settled failed run always ends with a failed attempt; anything else is a bug in the rule.
  if (first === undefined || last?.result !== "failed")
    throw new Error("runner bug: failed run without a failure");
  return ok({ first, last });
}

/** The app code most relevant to the test's requirement, fitted to the budget and redacted. */
async function appCode(
  deps: Deps,
  run: Run,
  finding: Finding,
  redact: Redact,
): Promise<
  Pick<DiagnosisPromptInput, "files" | "omittedFiles"> | { readonly error: DiagnoseFailureError }
> {
  const loaded = await loadSourceFiles(deps.repoReader, run.repoRoot, { readContents: true });
  if (!loaded.ok) return { error: loaded.error };
  const byPath = new Map(loaded.value.files.map((f) => [f.path, f]));
  const ranked = rankRelevantFiles(finding.requirement, indexFiles(loaded.value.files)).flatMap(
    (r) => byPath.get(r.path) ?? [],
  );
  const fitted = fitFilesToBudget(ranked);
  return {
    files: fitted.included.map((f) => ({ path: f.path, text: redact(f.text) })),
    omittedFiles: fitted.omitted,
  };
}

function promptInput(
  run: Run,
  specText: string,
  failed: { readonly first: AttemptReport; readonly last: FailedAttempt },
  finding: Finding | null,
  code: Pick<DiagnosisPromptInput, "files" | "omittedFiles">,
  redact: Redact,
): DiagnosisPromptInput {
  const { failure } = failed.last;
  const firstStep = failed.first.result === "failed" ? failed.first.failure.step : null;
  return {
    specPath: run.specPath,
    specCode: redact(specText),
    failure: {
      step: failure.step === null ? null : redact(failure.step),
      error: redact(failure.error),
      pageSnapshot: failure.pageSnapshot === undefined ? null : redact(failure.pageSnapshot),
    },
    firstAttemptStep: firstStep === null ? null : redact(firstStep),
    skippedSetupProjects: (failure.skippedSetupProjects ?? []).map(redact),
    requirement:
      finding === null
        ? null
        : {
            tag: redact(finding.requirement.tag),
            text: redact(finding.requirement.text),
            source: `${finding.requirement.source.file}:${String(finding.requirement.source.line)}`,
            finding: { type: finding.type, explanation: redact(finding.explanation) },
          },
    ...code,
  };
}

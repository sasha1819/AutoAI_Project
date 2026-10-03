import { err, ok, type Result } from "../core/domain/result.ts";
import type { AiProvider } from "../core/ports/ai-provider.ts";
import type { RepoReader } from "../core/ports/repo-reader.ts";
import {
  type DiagnoseFailureInput,
  type DiagnoseFailureResult,
  diagnoseFailure,
} from "../services/diagnose-failure.ts";
import { recordRun } from "./staged-recording.ts";

/**
 * Records Claude's diagnosis of one saved failure for the replay test (scripts/record-diagnoses.mjs), through the
 * shared rule (recordRun): saved only when the diagnosis succeeded, otherwise the folder is left as it was.
 */
export async function recordDiagnosis(
  deps: { readonly aiProvider: AiProvider; readonly repoReader: RepoReader },
  input: DiagnoseFailureInput & { readonly recordingsDir: string; readonly name: string },
): Promise<Result<DiagnoseFailureResult>> {
  const run = await recordRun({
    inner: deps.aiProvider,
    dir: input.recordingsDir,
    name: input.name,
    run: (aiProvider) => diagnoseFailure({ repoReader: deps.repoReader, aiProvider }, input),
    failureOf: (diagnosed) => (diagnosed.ok ? null : diagnosed.error),
  });
  if (!run.recording.ok) return err(run.recording.error);
  // A diagnosis that failed is always a recording failure (failureOf above), so this is the success case.
  return run.value.ok ? ok(run.value.value) : err(run.value.error);
}

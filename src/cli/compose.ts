import {
  type ClaudeAiProviderOptions,
  createClaudeAiProvider,
} from "../adapters/claude/claude-ai-provider.ts";
import { createFsRepoReader } from "../adapters/fs/fs-repo-reader.ts";
import { createFsTestWriter } from "../adapters/fs/fs-test-writer.ts";
import { createPlaywrightTestRunner } from "../adapters/playwright/playwright-test-runner.ts";
import { createTsSpecChecker } from "../adapters/playwright/ts-spec-checker.ts";
import type { Finding } from "../core/domain/finding.ts";
import type { StepEvent } from "../core/domain/step.ts";
import { extractRequirements } from "../services/extract-requirements.ts";
import { generateTests } from "../services/generate-tests.ts";
import { type DiagnoseFailureInput, diagnoseFailure } from "../services/diagnose-failure.ts";
import { type RunTestInput, runTest } from "../services/run-test.ts";
import { scanProject } from "../services/scan-project.ts";
import type { Result } from "../core/domain/result.ts";
import { type RecordingProblem, recordRun } from "./staged-recording.ts";

/** How a --record run went: saved files, or why nothing was saved; null when --record was not given. */
export type RecordingOutcome = Result<
  { readonly files: readonly string[] },
  RecordingProblem
> | null;

/** A result with how its --record went, typed once for every recorded command. */
function recorded<T>(result: T, recording: RecordingOutcome) {
  return { result, recording };
}

/** Terminal composition root: the only place the CLI creates adapters and hands them to services. */
export function composeCli() {
  const repoReader = createFsRepoReader();
  return {
    extractRequirements: (input: { readonly prdFolder: string }) =>
      extractRequirements({ repoReader }, input),
    scanProject: async (
      input: { readonly repoRoot: string; readonly prdFolder: string },
      ai: ClaudeAiProviderOptions,
      record?: { readonly dir: string; readonly runId: string },
    ) => {
      const claude = createClaudeAiProvider(ai);
      const scan = (aiProvider: typeof claude) => scanProject({ repoReader, aiProvider }, input);
      if (!record) return recorded(await scan(claude), null);
      // Recorded only when the whole scan succeeded: no failed call, not stopped, every area answered.
      const run = await recordRun({
        inner: claude,
        dir: record.dir,
        name: record.runId,
        run: scan,
        failureOf: (r) =>
          !r.ok
            ? r.error
            : (r.value.stoppedBy ??
              r.value.warnings.find(
                (w) => w.code === "BATCH_NOT_SCANNED" || w.code === "EXTRACTION_FAILED",
              ) ??
              null),
      });
      return recorded(run.value, run.recording);
    },
    generateTests: (
      input: { readonly repoRoot: string; readonly findings: readonly Finding[] },
      ai: ClaudeAiProviderOptions,
    ) =>
      generateTests(
        {
          repoReader,
          testWriter: createFsTestWriter(),
          specChecker: createTsSpecChecker(),
          aiProvider: createClaudeAiProvider(ai),
        },
        input,
      ),
    runTest: (input: RunTestInput, onStep: (event: StepEvent) => void, artifactsDir: string) =>
      runTest({ testRunner: createPlaywrightTestRunner({ artifactsDir }) }, input, onStep),
    diagnoseFailure: async (
      input: DiagnoseFailureInput,
      ai: ClaudeAiProviderOptions,
      record?: { readonly dir: string; readonly runId: string },
    ) => {
      const claude = createClaudeAiProvider(ai);
      const diagnose = (aiProvider: typeof claude) =>
        diagnoseFailure({ repoReader, aiProvider }, input);
      if (!record) return recorded(await diagnose(claude), null);
      const run = await recordRun({
        inner: claude,
        dir: record.dir,
        name: record.runId,
        run: diagnose,
        failureOf: (r) => (r.ok ? null : r.error),
      });
      return recorded(run.value, run.recording);
    },
  };
}

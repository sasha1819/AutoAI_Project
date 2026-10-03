import { copyFile, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { err, ok, type Result } from "../core/domain/result.ts";
import type { DomainError } from "../core/domain/domain-error.ts";
import type { AiError, AiProvider } from "../core/ports/ai-provider.ts";
import { recordingAiProvider } from "./recording-ai-provider.ts";

/** Why a run was not recorded: the failed call's or the case's own code and message. */
export type RecordingProblem = DomainError;

export type StagedRun<T> = {
  /** What the run produced, recorded or not (a paid-for answer is never lost to recording). */
  readonly value: T;
  /** The files saved in the recordings folder, or why nothing was saved. */
  readonly recording: Result<{ readonly files: readonly string[] }, RecordingProblem>;
};

/**
 * Every AI recorder's one rule (scan --record, diagnose --record, the record-* scripts): the run's calls are recorded
 * into a temporary folder, and only when the whole run succeeded do they replace that run's earlier recordings
 * (`<name>-<n>.json`) in `dir`. A failed call, a failure the caller reports, or a recording that could not be written
 * leaves `dir` exactly as it was: nothing is deleted first and a failed call is never saved.
 */
export async function recordRun<T>(input: {
  readonly inner: AiProvider;
  readonly dir: string;
  readonly name: string;
  readonly run: (ai: AiProvider) => Promise<T>;
  /** The case's own verdict on what the run produced: null when it succeeded. */
  readonly failureOf: (value: T) => RecordingProblem | null;
}): Promise<StagedRun<T>> {
  const staging = await mkdtemp(join(tmpdir(), "autoai-recording-"));
  try {
    let calls = 0;
    // Held in an object: it is set inside the provider below, which the type checker cannot follow.
    const seen: { failedCall: AiError | null } = { failedCall: null };
    const watched: AiProvider = {
      verifyAccess: () => input.inner.verifyAccess(),
      complete: async (request) => {
        calls += 1;
        const result = await input.inner.complete(request);
        if (!result.ok) seen.failedCall ??= result.error;
        return result;
      },
    };
    const value = await input.run(recordingAiProvider(watched, staging, input.name));
    // A failed call first: it is the cause; the case's own verdict usually just follows from it.
    const problem = seen.failedCall ?? input.failureOf(value);
    const recording = problem ? err(problem) : await commit(staging, input, calls);
    return { value, recording };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

/** Moves a successful run's recordings into place, replacing that run's earlier ones. */
async function commit(
  staging: string,
  target: { readonly dir: string; readonly name: string },
  calls: number,
): Promise<StagedRun<unknown>["recording"]> {
  const isRun = (f: string) => f.startsWith(`${target.name}-`) && f.endsWith(".json");
  const staged = (await readdir(staging)).filter(isRun).sort(byCallNumber);
  if (staged.length !== calls)
    return err({
      code: "RECORDING_NOT_WRITTEN",
      message: `${String(calls - staged.length)} of ${String(calls)} calls could not be saved`,
    });

  await mkdir(target.dir, { recursive: true });
  const old = (await readdir(target.dir)).filter(isRun);
  for (const f of old) await rm(join(target.dir, f));
  // Copied, not renamed: the staging folder may be on another disk.
  for (const f of staged) await copyFile(join(staging, f), join(target.dir, f));
  return ok({ files: staged });
}

function byCallNumber(a: string, b: string): number {
  const n = (f: string) => Number(/-(\d+)\.json$/.exec(f)?.[1] ?? 0);
  return n(a) - n(b);
}

/** The one line every recorder prints when nothing was saved: "<case>: not recorded. <CODE>: <message>". */
export function notRecordedLine(label: string, problem: RecordingProblem): string {
  return `${label}: not recorded. ${problem.code}: ${problem.message}`;
}

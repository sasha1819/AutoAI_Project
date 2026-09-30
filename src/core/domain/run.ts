import { z } from "zod";
import { RunId } from "./ids.ts";
import { StepEvent } from "./step.ts";

/** The outcome of a whole run of one test, after any retry (ARCHITECTURE §4). */
export const RunStatus = z.enum(["passed", "failed", "flaky", "not_run"]);
export type RunStatus = z.infer<typeof RunStatus>;

/** One execution of a test, exactly as Playwright reported it. Only a run, never an attempt, can be flaky. */
export const AttemptResult = z.enum(["passed", "failed"]);
export type AttemptResult = z.infer<typeof AttemptResult>;

/**
 * What was captured when an attempt failed, before any AI sees it (PRD Flow 4 step 15). `step` is null when the
 * failure happened outside any step (e.g. the test timed out between steps). `pageSnapshot` is Playwright's text
 * snapshot of the page, the "DOM state"; older Playwright versions don't produce one.
 */
export const FailureCapture = z.object({
  step: z.string().min(1).nullable(),
  error: z.string().min(1),
  screenshotPath: z.string().min(1).optional(),
  pageSnapshot: z.string().optional(),
  /** Setup projects (e.g. a login step) the test's project depends on that the runner did not run (ADR 0005). */
  skippedSetupProjects: z.array(z.string().min(1)).min(1).readonly().optional(),
});
export type FailureCapture = z.infer<typeof FailureCapture>;

/** Everything one attempt produced. A failed attempt always carries its capture; a passed one never does. */
export const AttemptReport = z.discriminatedUnion("result", [
  z.strictObject({
    result: z.literal("passed"),
    durationMs: z.number().int().nonnegative(),
    steps: z.array(StepEvent).readonly(),
  }),
  z.strictObject({
    result: z.literal("failed"),
    durationMs: z.number().int().nonnegative(),
    steps: z.array(StepEvent).readonly(),
    failure: FailureCapture,
  }),
]);
export type AttemptReport = z.infer<typeof AttemptReport>;

/**
 * One run of a generated spec, as decided by the run-status rule: its status and every attempt, in order (a flaky
 * or failed run keeps both). This is what gets stored and shown.
 */
export const Run = z.object({
  runId: RunId,
  repoRoot: z.string().min(1),
  specPath: z.string().min(1),
  status: RunStatus,
  attempts: z.array(AttemptReport).min(1).readonly(),
});
export type Run = z.infer<typeof Run>;

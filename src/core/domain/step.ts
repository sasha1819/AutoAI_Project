import { z } from "zod";
import { RunId } from "./ids.ts";

/** A step is reported when it starts (running) and again when it ends. Only a run, never a step, can be flaky. */
export const StepStatus = z.enum(["running", "passed", "failed"]);
export type StepStatus = z.infer<typeof StepStatus>;

/**
 * One line of the live run log (reliability-rules §6, ADR 0005). `attempt` keeps the two attempts of a retried
 * run apart; `ts` is when the step started (running) or ended (passed/failed).
 */
export const StepEvent = z.object({
  runId: RunId,
  attempt: z.number().int().min(1),
  step: z.string().min(1),
  status: StepStatus,
  durationMs: z.number().int().nonnegative(),
  ts: z.iso.datetime(),
});
export type StepEvent = z.infer<typeof StepEvent>;

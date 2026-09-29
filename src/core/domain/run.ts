import { z } from "zod";

/** The outcome of a whole run of one test, after any retry (ARCHITECTURE §4). */
export const RunStatus = z.enum(["passed", "failed", "flaky", "not_run"]);
export type RunStatus = z.infer<typeof RunStatus>;

/** One execution of a test, exactly as Playwright reported it. Only a run, never an attempt, can be flaky. */
export const AttemptResult = z.enum(["passed", "failed"]);
export type AttemptResult = z.infer<typeof AttemptResult>;

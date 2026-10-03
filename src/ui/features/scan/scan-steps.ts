import type { ScanProgress } from "../../../core/domain/scan-progress.ts";
import type { PillStatus } from "../../design-system/patterns/StatusPill/index.ts";
import { plural } from "./wording.ts";

/** A progress event with when it arrived (ms), so each step can say how long it took. */
export type Timed = { readonly at: number; readonly progress: ScanProgress };

/** How the scan ended, as far as the screen knows: still going, finished, failed to run, or stopped by the AI. */
export type ScanOutcome = "running" | "done" | "failed" | "stopped";

export type ScanStepId = "prds" | "code" | "compare";

export type ScanStep = {
  readonly id: ScanStepId;
  readonly name: string;
  readonly status: PillStatus;
  readonly durationMs?: number;
};

export type ScanSteps = {
  readonly steps: readonly [ScanStep, ScanStep, ScanStep];
  /** Areas compared so far, once Claude has started comparing; null otherwise. */
  readonly compare: {
    readonly done: number;
    readonly total: number;
    readonly area: string | null;
  } | null;
  /** One short line for screen readers about the stage the scan is in now (said once per stage). */
  readonly now: string;
};

type Of<S extends ScanProgress["stage"]> = Timed & {
  progress: Extract<ScanProgress, { stage: S }>;
};

/**
 * The three steps the screen shows, from the progress events the scan service streams (in order: ScanProgress).
 * Pure, so every state is tested without a scan. It only words what was observed: a step is passed when its closing
 * event arrived; it failed only when the scan failed while that step was running (a failure before any event, such
 * as a missing key or a busy scanner, is not blamed on a step); once the scan has ended nothing is shown as running.
 */
export function scanSteps(events: readonly Timed[], outcome: ScanOutcome): ScanSteps {
  const find = <S extends ScanProgress["stage"]>(stage: S) =>
    events.find((e): e is Of<S> => e.progress.stage === stage);
  const prdsStart = find("reading_prds") ?? events[0];
  const prdsRead = find("prds_read");
  const codeStart = find("reading_code");
  const codeRead = find("code_read");
  const matching = events.filter((e): e is Of<"matching"> => e.progress.stage === "matching");
  const lastMatch = matching.at(-1);
  const done = find("done");

  // The step the scan is on: the first one whose closing event has not arrived.
  const current: ScanStepId | null =
    prdsRead === undefined
      ? "prds"
      : codeRead === undefined
        ? "code"
        : done === undefined
          ? "compare"
          : null;
  const open = (id: ScanStepId): PillStatus => {
    if (current !== id) return "not_run";
    if (outcome === "running") return "running";
    // Ended while on this step: failed only if the scan had really begun (some event arrived).
    return outcome === "failed" && events.length > 0 ? "failed" : "not_run";
  };
  const took = (from: Timed | undefined, to: Timed) =>
    withDuration(from === undefined ? undefined : to.at - from.at);

  const prds: ScanStep = prdsRead
    ? {
        id: "prds",
        name: `Read your PRDs: ${prdSummary(prdsRead.progress.prdFiles, prdsRead.progress.requirements)}`,
        status: "passed",
        ...took(prdsStart, prdsRead),
      }
    : { id: "prds", name: "Read your PRDs", status: open("prds") };

  const code: ScanStep = codeRead
    ? {
        id: "code",
        name: `Read your code: ${plural(codeRead.progress.sourceFiles, "source file")}`,
        status: "passed",
        ...took(codeStart ?? prdsRead, codeRead),
      }
    : { id: "code", name: "Read your code", status: open("code") };

  let compareStep: ScanStep;
  if (lastMatch === undefined) {
    // Observed, not predicted: the scan finished without comparing any area.
    compareStep =
      done === undefined
        ? { id: "compare", name: "Compare with Claude", status: open("compare") }
        : { id: "compare", name: "Compare with Claude: nothing to compare", status: "not_run" };
  } else {
    const { area, batch, batches } = lastMatch.progress;
    const where = `${area}, area ${String(batch)} of ${String(batches)}`;
    compareStep =
      outcome === "stopped"
        ? { id: "compare", name: `Compare with Claude: stopped at ${where}`, status: "failed" }
        : done !== undefined
          ? {
              id: "compare",
              name: `Compare with Claude: ${plural(batches, "area")}`,
              status: "passed",
              ...took(matching[0], done),
            }
          : { id: "compare", name: `Compare with Claude: ${where}`, status: open("compare") };
  }

  const compare =
    lastMatch === undefined
      ? null
      : {
          done: done === undefined ? lastMatch.progress.batch - 1 : lastMatch.progress.batches,
          total: lastMatch.progress.batches,
          area: done === undefined ? lastMatch.progress.area : null,
        };
  const now =
    current === "prds"
      ? "Reading your PRDs."
      : current === "code"
        ? "Reading your code."
        : current === "compare" && lastMatch !== undefined
          ? `Comparing area ${String(lastMatch.progress.batch)} of ${String(lastMatch.progress.batches)}.`
          : current === "compare"
            ? "Getting ready to compare."
            : "";
  return { steps: [prds, code, compareStep], compare, now };
}

function prdSummary(files: number, requirements: number): string {
  if (files === 0) return "no PRD files";
  const where = plural(files, "file");
  return requirements === 0
    ? `no requirements found in ${where}`
    : `${plural(requirements, "requirement")} in ${where}`;
}

function withDuration(ms: number | undefined): { durationMs?: number } {
  return ms === undefined ? {} : { durationMs: ms };
}

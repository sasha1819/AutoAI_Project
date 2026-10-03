import type { ScanProgress } from "../../../core/domain/scan-progress.ts";
import type { PillStatus } from "../../design-system/patterns/StatusPill/index.ts";
import { plural } from "../../design-system/wording/index.ts";

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
  /** Claude is reading plain-prose PRDs right now (ADR 0008), not yet comparing. */
  readonly extracting: boolean;
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
  const parsedRead = find("prds_read");
  // Plain-prose PRDs read by Claude (ADR 0008): reading the PRDs ends when Claude has read them too.
  const extracting = events.filter((e): e is Of<"extracting"> => e.progress.stage === "extracting");
  const lastExtracting = extracting.at(-1);
  const extracted = find("extracted");
  const prdsRead = extracting.length > 0 ? (extracted ? parsedRead : undefined) : parsedRead;
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

  const prdsName = (): string => {
    if (prdsRead === undefined) return "Read your PRDs";
    const { prdFiles, requirements } = prdsRead.progress;
    if (!extracted) return `Read your PRDs: ${prdSummary(prdFiles, requirements)}`;
    // Plain-prose files were read by Claude (ADR 0008): say how many, then what Claude found.
    const prose = lastExtracting?.progress.total ?? 0;
    const written =
      requirements === 0
        ? `${plural(prose, "file")} in prose`
        : `${plural(requirements, "requirement")} in ${plural(prdFiles, "file")}`;
    const found = extracted.progress.requirements + extracted.progress.needsReview;
    const review = extracted.progress.needsReview;
    const byClaude =
      found === 0
        ? "Claude found none"
        : `Claude found ${plural(found, requirements === 0 ? "requirement" : "more requirement")}${review > 0 ? ` (${String(review)} for your review)` : ""}`;
    return `Read your PRDs: ${written}; ${byClaude}`;
  };
  const where = lastExtracting
    ? `${lastExtracting.progress.file} (${String(lastExtracting.progress.index)} of ${String(lastExtracting.progress.total)})`
    : "";
  const prds: ScanStep = prdsRead
    ? { id: "prds", name: prdsName(), status: "passed", ...took(prdsStart, extracted ?? prdsRead) }
    : {
        id: "prds",
        name:
          lastExtracting === undefined
            ? "Read your PRDs"
            : outcome === "running"
              ? `Read your PRDs: Claude is reading ${where}`
              : `Read your PRDs: stopped while Claude read ${where}`,
        status: open("prds"),
      };

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
        : outcome === "stopped"
          ? // Claude stopped while reading the PRDs, before any area was compared.
            {
              id: "compare",
              name: "Compare with Claude: stopped before comparing",
              status: "failed",
            }
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
    current === "prds" && lastExtracting !== undefined
      ? `Claude is reading ${lastExtracting.progress.file}, file ${String(lastExtracting.progress.index)} of ${String(lastExtracting.progress.total)}.`
      : current === "prds"
        ? "Reading your PRDs."
        : current === "code"
          ? "Reading your code."
          : current === "compare" && lastMatch !== undefined
            ? `Comparing area ${String(lastMatch.progress.batch)} of ${String(lastMatch.progress.batches)}.`
            : current === "compare"
              ? "Getting ready to compare."
              : "";
  return {
    steps: [prds, code, compareStep],
    compare,
    now,
    extracting: outcome === "running" && current === "prds" && lastExtracting !== undefined,
  };
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

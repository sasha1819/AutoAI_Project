import { describe, expect, it } from "vitest";
import type { ScanProgress } from "../../../core/domain/scan-progress.ts";
import { scanSteps, type Timed } from "./scan-steps.ts";

const at = (ms: number, progress: ScanProgress): Timed => ({ at: ms, progress });
const names = (s: ReturnType<typeof scanSteps>) => s.steps.map((x) => `${x.name} | ${x.status}`);

describe("scanSteps", () => {
  it("before any event: reading PRDs runs, the rest waits", () => {
    expect(names(scanSteps([], "running"))).toStrictEqual([
      "Read your PRDs | running",
      "Read your code | not_run",
      "Compare with Claude | not_run",
    ]);
  });

  it("each stage that finished says what it found and how long it took", () => {
    const s = scanSteps(
      [
        at(0, { stage: "reading_prds" }),
        at(40, { stage: "prds_read", prdFiles: 2, requirements: 5 }),
        at(50, { stage: "reading_code" }),
        at(300, { stage: "code_read", sourceFiles: 128 }),
        at(310, { stage: "matching", area: "Cart", batch: 1, batches: 3 }),
        at(900, { stage: "matching", area: "Checkout", batch: 2, batches: 3 }),
      ],
      "running",
    );
    expect(names(s)).toStrictEqual([
      "Read your PRDs: 5 requirements in 2 files | passed",
      "Read your code: 128 source files | passed",
      "Compare with Claude: Checkout, area 2 of 3 | running",
    ]);
    expect(s.steps.map((x) => x.durationMs)).toStrictEqual([40, 250, undefined]);
    expect(s.compare).toStrictEqual({ done: 1, total: 3, area: "Checkout" });
  });

  it("no requirements: nothing is compared, and the step says why", () => {
    const s = scanSteps(
      [
        at(0, { stage: "reading_prds" }),
        at(5, { stage: "prds_read", prdFiles: 0, requirements: 0 }),
        at(6, { stage: "reading_code" }),
        at(20, { stage: "code_read", sourceFiles: 1 }),
        at(21, { stage: "done" }),
      ],
      "done",
    );
    expect(names(s)).toStrictEqual([
      "Read your PRDs: no PRD files | passed",
      "Read your code: 1 source file | passed",
      "Compare with Claude: nothing to compare | not_run",
    ]);
    expect(s.compare).toBeNull();
  });

  it("PRD files with no requirements (plain prose) say so, not '0 requirements'", () => {
    const s = scanSteps([at(0, { stage: "prds_read", prdFiles: 2, requirements: 0 })], "running");
    expect(names(s)[0]).toBe("Read your PRDs: no requirements found in 2 files | passed");
    expect(names(s)[2]).toBe("Compare with Claude | not_run");
  });

  it("done: every area compared", () => {
    const s = scanSteps(
      [
        at(0, { stage: "reading_prds" }),
        at(1, { stage: "prds_read", prdFiles: 1, requirements: 1 }),
        at(2, { stage: "reading_code" }),
        at(3, { stage: "code_read", sourceFiles: 4 }),
        at(4, { stage: "matching", area: "Cart", batch: 1, batches: 1 }),
        at(1004, { stage: "done" }),
      ],
      "done",
    );
    expect(names(s).at(-1)).toBe("Compare with Claude: 1 area | passed");
    expect(s.steps.at(-1)?.durationMs).toBe(1000);
    expect(s.compare).toStrictEqual({ done: 1, total: 1, area: null });
  });

  it("a failure before any event (key, busy scanner, broken reply) is not blamed on a step", () => {
    expect(names(scanSteps([], "failed"))).toStrictEqual([
      "Read your PRDs | not_run",
      "Read your code | not_run",
      "Compare with Claude | not_run",
    ]);
  });

  it("once the scan has ended, no step is shown as running", () => {
    const s = scanSteps(
      [
        at(0, { stage: "prds_read", prdFiles: 1, requirements: 1 }),
        at(1, { stage: "code_read", sourceFiles: 2 }),
      ],
      "done",
    );
    expect(names(s)[2]).toBe("Compare with Claude | not_run");
  });

  it("says the current stage in one short line, for screen readers", () => {
    expect(scanSteps([], "running").now).toBe("Reading your PRDs.");
    expect(
      scanSteps(
        [
          at(0, { stage: "prds_read", prdFiles: 1, requirements: 2 }),
          at(1, { stage: "code_read", sourceFiles: 2 }),
          at(2, { stage: "matching", area: "Cart", batch: 2, batches: 3 }),
        ],
        "running",
      ).now,
    ).toBe("Comparing area 2 of 3.");
  });

  it("a scan that failed marks the step it was on as failed; later ones never ran", () => {
    const s = scanSteps(
      [
        at(0, { stage: "reading_prds" }),
        at(1, { stage: "prds_read", prdFiles: 1, requirements: 2 }),
        at(2, { stage: "reading_code" }),
      ],
      "failed",
    );
    expect(names(s)).toStrictEqual([
      "Read your PRDs: 2 requirements in 1 file | passed",
      "Read your code | failed",
      "Compare with Claude | not_run",
    ]);
  });

  it("stopped by an AI error while comparing: the compare step failed", () => {
    const s = scanSteps(
      [
        at(0, { stage: "prds_read", prdFiles: 1, requirements: 2 }),
        at(1, { stage: "code_read", sourceFiles: 2 }),
        at(2, { stage: "matching", area: "Cart", batch: 1, batches: 2 }),
        at(3, { stage: "done" }),
      ],
      "stopped",
    );
    expect(names(s).at(-1)).toBe("Compare with Claude: stopped at Cart, area 1 of 2 | failed");
  });
});

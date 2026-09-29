import { describe, expect, it } from "vitest";
import { lineSplitter, parseReporterLine } from "./reporter-events.ts";

const step = {
  kind: "step",
  retry: 0,
  status: "passed",
  step: "Click getByRole('button')",
  durationMs: 3,
  ts: "2026-09-29T17:00:00.000Z",
};

describe("parseReporterLine", () => {
  it("reads an AutoAI reporter line", () => {
    expect(parseReporterLine(`AUTOAI:${JSON.stringify(step)}`)).toStrictEqual(step);
  });

  it.each([
    ["the user's own output", "Sample shop running at http://localhost:4173"],
    ["broken JSON", "AUTOAI:{broken"],
    ["a line that only looks like ours", 'AUTOAI:{"kind":"test"}'],
    ["an unknown status", `AUTOAI:${JSON.stringify({ ...step, status: "flaky" })}`],
    ["the prefix mid-line", ` AUTOAI:${JSON.stringify(step)}`],
  ])("ignores %s", (_name, line) => {
    expect(parseReporterLine(line)).toBeNull();
  });
});

describe("lineSplitter", () => {
  it("joins lines split across chunks and flushes the last one", () => {
    const lines: string[] = [];
    const split = lineSplitter((l) => lines.push(l));
    split.push("one\ntw");
    split.push("o\r\nthr");
    expect(lines).toStrictEqual(["one", "two"]);
    split.end();
    expect(lines).toStrictEqual(["one", "two", "thr"]);
  });
});

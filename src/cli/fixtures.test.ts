import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { composeCli } from "./compose.ts";

// Keeps fixtures/expected-findings.json honest: every entry must match the real PRDs, the real sample repo,
// and what today's parser extracts. If one of these fails, the accuracy test would be measuring nothing.
const FIXTURES = join(import.meta.dirname, "..", "..", "fixtures");
const PRDS = join(FIXTURES, "sample-prds");
const REPO = join(FIXTURES, "sample-repo");

const AnswerKey = z.object({
  about: z.string(),
  findings: z.array(
    z
      .object({
        prd: z.object({ file: z.string(), line: z.number().int().positive() }),
        tag: z.string().nullable(),
        parser: z.enum(["extracted", "not_extracted"]),
        type: z.enum(["match", "mismatch", "not_implemented"]),
        severity: z.enum(["high", "medium", "low"]).optional(),
        evidence: z.object({
          file: z.string(),
          lines: z.tuple([z.number().int().positive(), z.number().int().positive()]),
          snippet: z.string().min(1),
        }),
        why: z.string().min(1),
      })
      .refine((f) => (f.type === "mismatch") === (f.severity !== undefined), {
        message: "a mismatch needs an expected severity; other types must not have one",
      }),
  ),
});
const key = AnswerKey.parse(
  JSON.parse(readFileSync(join(FIXTURES, "expected-findings.json"), "utf8")),
);
const at = (f: { prd: { file: string; line: number } }) => `${f.prd.file}:${String(f.prd.line)}`;

function* files(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* files(p);
    else yield p;
  }
}

describe("fixtures/expected-findings.json", () => {
  it("plants exactly 3 mismatches and 2 correct features, each at a distinct PRD location", () => {
    expect(key.findings.filter((f) => f.type === "mismatch")).toHaveLength(3);
    expect(key.findings.filter((f) => f.type === "match")).toHaveLength(2);
    expect(new Set(key.findings.map(at)).size).toBe(key.findings.length);
  });

  it("says exactly which requirements today's parser extracts, at the stated location and tag", async () => {
    const result = await composeCli().extractRequirements({ prdFolder: PRDS });
    if (!result.ok) throw new Error(result.error.message);
    const extracted = result.value.requirements.map((r) => ({
      where: `${r.source.file}:${String(r.source.line)}`,
      tag: r.tag,
    }));
    const expected = key.findings
      .filter((f) => f.parser === "extracted")
      .map((f) => ({ where: at(f), tag: f.tag }));
    expect(extracted).toStrictEqual(expected);
    for (const f of key.findings.filter((x) => x.parser === "not_extracted")) {
      expect(result.value.prdFiles).toContain(f.prd.file);
      expect(extracted.map((e) => e.where)).not.toContain(at(f));
    }
  });

  it("points every PRD location at a non-empty line", () => {
    for (const f of key.findings) {
      const line = readFileSync(join(PRDS, f.prd.file), "utf8").split("\n")[f.prd.line - 1];
      expect(line?.trim(), at(f)).toBeTruthy();
    }
  });

  it("cites evidence that really is in the sample repo at the stated lines", () => {
    for (const f of key.findings) {
      const [from, to] = f.evidence.lines;
      const lines = readFileSync(join(REPO, f.evidence.file), "utf8").split("\n");
      expect(to, `${f.evidence.file} has ${String(lines.length)} lines`).toBeLessThanOrEqual(
        lines.length,
      );
      expect(from).toBeLessThanOrEqual(to);
      expect(lines.slice(from - 1, to).join("\n"), at(f)).toContain(f.evidence.snippet);
    }
  });

  it("leaks no answers into the sample repo the scan engine reads", () => {
    const tell =
      /mismatch|planted|answer|expected-findings|fixme|todo|\bbug|\bspec\b|\bprd\b|requirement|should|wrong|case.?(in)?sensitive|Cart \d|Shipping \d/i;
    for (const file of files(REPO)) {
      const hit = readFileSync(file, "utf8")
        .split("\n")
        .find((l) => tell.test(l));
      expect(hit, relative(FIXTURES, file)).toBeUndefined();
    }
  });
});

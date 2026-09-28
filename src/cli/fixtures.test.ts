import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { indexFiles, rankRelevantFiles } from "../core/rules/relevance.ts";
import { composeCli } from "./compose.ts";

// Keeps fixtures/expected-findings.json honest: every entry must match the real PRDs, the real sample repo,
// and what today's parser extracts. If one of these fails, the accuracy test would be measuring nothing.
const FIXTURES = join(import.meta.dirname, "..", "..", "fixtures");
const PRDS = join(FIXTURES, "sample-prds");
const REPO = join(FIXTURES, "sample-repo");

const base = {
  prd: z.strictObject({ file: z.string(), line: z.number().int().positive() }),
  tag: z.string().nullable(),
  parser: z.enum(["extracted", "not_extracted"]),
  why: z.string().min(1),
};
const Evidence = z.strictObject({
  file: z.string(),
  lines: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  snippet: z.string().min(1),
});
const Finding = z.discriminatedUnion("type", [
  z.strictObject({ ...base, type: z.literal("match"), evidence: Evidence }),
  z.strictObject({
    ...base,
    type: z.literal("mismatch"),
    severity: z.enum(["high", "medium", "low"]),
    evidence: Evidence,
  }),
  // Nothing to cite for a feature that was never built; instead, name what must not exist in the repo.
  z.strictObject({
    ...base,
    type: z.literal("not_implemented"),
    severity: z.enum(["high", "medium", "low"]),
    absentTerms: z.array(z.string().min(3)).min(1),
  }),
]);
const key = z
  .strictObject({ about: z.string(), findings: z.array(Finding) })
  .parse(JSON.parse(readFileSync(join(FIXTURES, "expected-findings.json"), "utf8")));

const at = (f: { prd: { file: string; line: number } }) => `${f.prd.file}:${String(f.prd.line)}`;
const withEvidence = key.findings.flatMap((f) => (f.type === "not_implemented" ? [] : [f]));
const notImplemented = key.findings.flatMap((f) => (f.type === "not_implemented" ? [f] : []));

function* files(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* files(p);
    else yield p;
  }
}
const repoFiles = [...files(REPO)].map((path) => ({ path, text: readFileSync(path, "utf8") }));

describe("fixtures/expected-findings.json", () => {
  it("plants 3 mismatches, 2 correct features and 1 not-implemented feature, each at a distinct PRD location", () => {
    const count = (type: string) => key.findings.filter((f) => f.type === type).length;
    expect({
      mismatch: count("mismatch"),
      match: count("match"),
      not_implemented: count("not_implemented"),
    }).toStrictEqual({ mismatch: 3, match: 2, not_implemented: 1 });
    expect(new Set(key.findings.map(at)).size).toBe(key.findings.length);
  });

  it("keeps Account 3.1 (order history) categorized as not_implemented, never as a mismatch", () => {
    const account = key.findings.filter((f) => f.tag === "Account 3.1");
    expect(account.map((f) => [at(f), f.type])).toStrictEqual([["shop.md:19", "not_implemented"]]);
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
    for (const f of withEvidence) {
      const [from, to] = f.evidence.lines;
      const lines = readFileSync(join(REPO, f.evidence.file), "utf8").split("\n");
      expect(to, `${f.evidence.file} has ${String(lines.length)} lines`).toBeLessThanOrEqual(
        lines.length,
      );
      expect(from).toBeLessThanOrEqual(to);
      expect(lines.slice(from - 1, to).join("\n"), at(f)).toContain(f.evidence.snippet);
    }
  });

  it("lets the relevance rule rank each extracted requirement's evidence file in its top 3", async () => {
    const result = await composeCli().extractRequirements({ prdFolder: PRDS });
    if (!result.ok) throw new Error(result.error.message);
    const index = indexFiles(
      repoFiles.map(({ path, text }) => ({
        path: relative(REPO, path).split(sep).join("/"),
        text,
      })),
    );
    for (const f of withEvidence.filter((x) => x.parser === "extracted")) {
      const requirement = result.value.requirements.find(
        (r) => `${r.source.file}:${String(r.source.line)}` === at(f),
      );
      if (!requirement) throw new Error(`${at(f)} not extracted`);
      const top = rankRelevantFiles(requirement, index, 3).map((r) => r.path);
      expect(top, at(f)).toContain(f.evidence.file);
    }
  });

  it("has no code for a not-implemented feature anywhere in the sample repo", () => {
    // "order history", "orderHistory" and "order-history" must all count, so compare without case or separators.
    const squash = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");
    for (const f of notImplemented) {
      for (const term of f.absentTerms) {
        const hit = repoFiles.find((r) => squash(r.text).includes(squash(term)));
        expect(hit && relative(FIXTURES, hit.path), `${at(f)} "${term}"`).toBeUndefined();
      }
    }
  });

  it("leaks no answers into the sample repo the scan engine reads", () => {
    const tags = key.findings.flatMap((f) => (f.tag === null ? [] : [f.tag.replace(".", "\\.")]));
    const tell = new RegExp(
      `mismatch|planted|answer|expected-findings|fixme|todo|\\bbug|\\bspec\\b|\\bprd\\b|requirement|should|wrong|case.?(in)?sensitive|${tags.join("|")}`,
      "i",
    );
    for (const { path, text } of repoFiles) {
      expect(
        text.split("\n").find((l) => tell.test(l)),
        relative(FIXTURES, path),
      ).toBeUndefined();
    }
  });
});

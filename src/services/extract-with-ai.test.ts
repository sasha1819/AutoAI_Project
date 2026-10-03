import { describe, expect, it } from "vitest";
import type { ScanProgress } from "../core/domain/scan-progress.ts";
import { newAiTally } from "./ask-ai.ts";
import { extractWithAi } from "./extract-with-ai.ts";
import { inMemoryRepoReader } from "./testing/in-memory-repo-reader.ts";
import { scriptedAiProvider } from "./testing/scripted-ai-provider.ts";

const vision =
  "Our shop\n\nThe checkout button stays disabled until the cart has an item.\nWe love customers.";
const answer = (items: unknown[]) => JSON.stringify({ requirements: items });
const disabled = {
  area: "Checkout",
  text: "Checkout is disabled while the cart is empty.",
  quote: {
    lines: [3, 3],
    snippet: "The checkout button stays disabled until the cart has an item.",
  },
  confidence: 0.9,
};
const run = (ai: ReturnType<typeof scriptedAiProvider>, files = ["vision.md"]) => {
  const progress: ScanProgress[] = [];
  const tally = newAiTally();
  return extractWithAi(
    {
      repoReader: inMemoryRepoReader({ p: { "vision.md": vision, "b.md": vision } }),
      aiProvider: ai,
    },
    { prdFolder: "p", files, tally, onProgress: (e) => progress.push(e) },
  ).then((result) => ({ result, progress, tally }));
};

describe("extractWithAi", () => {
  it("reads each file with Claude, one call per file, and reports progress", async () => {
    const ai = scriptedAiProvider(answer([disabled]), answer([{ ...disabled, confidence: 0.4 }]));
    const { result, progress, tally } = await run(ai, ["vision.md", "b.md"]);
    expect(result.requirements.map((r) => r.tag)).toStrictEqual(["Checkout (AI) 1"]);
    expect(result.needsReview.map((c) => c.source.file)).toStrictEqual(["b.md"]);
    expect(progress).toStrictEqual([
      { stage: "extracting", file: "vision.md", index: 1, total: 2 },
      { stage: "extracting", file: "b.md", index: 2, total: 2 },
    ]);
    expect(tally.aiCalls).toBe(2);
    expect(ai.requests[0]?.user).toContain('<prd file="vision.md">');
  });

  it("an answer that stays invalid becomes a warning, and the next file is still read", async () => {
    const ai = scriptedAiProvider("nonsense", "still nonsense", answer([disabled]));
    const { result } = await run(ai, ["vision.md", "b.md"]);
    expect(result.warnings.map((w) => w.code)).toStrictEqual(["EXTRACTION_FAILED"]);
    expect(result.warnings[0]?.message).toContain("vision.md");
    expect(result.requirements).toHaveLength(1);
  });

  it("an AI error that would fail every call stops it, keeping what it has", async () => {
    const ai = scriptedAiProvider(answer([disabled]), { code: "AI_AUTH_FAILED", message: "401" });
    const { result } = await run(ai, ["vision.md", "b.md"]);
    expect(result.stoppedBy?.code).toBe("AI_AUTH_FAILED");
    expect(result.requirements).toHaveLength(1);
    expect(result.filesRead).toBe(1);
  });

  it("an AI error with one prompt skips only that file", async () => {
    const ai = scriptedAiProvider({ code: "AI_REFUSED", message: "no" }, answer([disabled]));
    const { result } = await run(ai, ["vision.md", "b.md"]);
    expect(result.stoppedBy).toBeNull();
    expect(result.warnings.map((w) => w.code)).toStrictEqual(["EXTRACTION_FAILED"]);
    expect(result.requirements).toHaveLength(1);
  });

  it("counts the items dropped for a quote that is not in the file", async () => {
    const ai = scriptedAiProvider(
      answer([{ ...disabled, quote: { lines: [1, 1], snippet: "Invented text here" } }]),
    );
    const { result } = await run(ai);
    expect(result.dropped).toBe(1);
    expect(result.requirements).toHaveLength(0);
  });

  it("two files in the same area get different tags", async () => {
    const ai = scriptedAiProvider(answer([disabled]), answer([disabled]));
    const { result } = await run(ai, ["vision.md", "b.md"]);
    expect(result.requirements.map((r) => r.tag)).toStrictEqual([
      "Checkout (AI) 1",
      "Checkout (AI) 2",
    ]);
    expect(result.filesRead).toBe(2);
  });

  it("a file that cannot be read becomes a warning, is not counted as read, and costs no call", async () => {
    const ai = scriptedAiProvider(answer([disabled]));
    const { result, tally } = await run(ai, ["missing.md", "vision.md"]);
    expect(result.warnings.map((w) => w.code)).toStrictEqual(["EXTRACTION_FAILED"]);
    expect(result.warnings[0]?.message).toContain("missing.md");
    expect([result.filesRead, tally.aiCalls]).toStrictEqual([1, 1]);
  });

  it("no files: no calls, nothing found", async () => {
    const ai = scriptedAiProvider();
    const { result, tally } = await run(ai, []);
    expect([result.requirements, result.needsReview, tally.aiCalls]).toStrictEqual([[], [], 0]);
  });
});

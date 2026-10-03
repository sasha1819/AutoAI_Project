import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ok } from "../core/domain/result.ts";
import type { AiProvider, AiRequest } from "../core/ports/ai-provider.ts";
import { newAiTally } from "./ask-ai.ts";
import { extractWithAi } from "./extract-with-ai.ts";
import { inMemoryRepoReader } from "./testing/in-memory-repo-reader.ts";

// Offline replay of real Claude extraction recordings (ADR 0008; made with scripts/record-extractions.mjs and the
// user's key). The prompt built today from the fixture must be byte-for-byte the one Claude answered, and that real
// answer must still parse under the three-way rule. A prompt change fails here until the recordings are made again.
// Until the first recording exists, the cases are skipped (and say so) rather than passing silently.
const FIXTURES = join(import.meta.dirname, "../../fixtures");
const RECORDINGS = join(FIXTURES, "recorded/claude-extraction");

const Recording = z.object({
  request: z.object({
    system: z.string(),
    user: z.string(),
    jsonSchema: z.record(z.string(), z.unknown()),
  }),
  result: z.object({
    ok: z.literal(true),
    value: z.object({
      text: z.string(),
      model: z.string(),
      usage: z.object({ inputTokens: z.number(), outputTokens: z.number() }),
    }),
  }),
});
type Recording = z.infer<typeof Recording>;
// What an old recorder saved for a failed call; recordExtraction no longer writes these.
const FailedCall = z.object({
  result: z.object({
    ok: z.literal(false),
    error: z.object({ code: z.string(), message: z.string() }),
  }),
});

function replay(recording: Recording): AiProvider & { readonly asked: AiRequest[] } {
  const asked: AiRequest[] = [];
  return {
    asked,
    complete: (request) => {
      asked.push(request);
      return Promise.resolve(ok(recording.result.value));
    },
    verifyAccess: () => {
      throw new Error("a replay never checks the key");
    },
  };
}

const CASES = [
  {
    name: "checkout",
    file: "checkout.md",
    // The planted requirement (fixtures/expected-findings.json, checkout.md section at line 5, body on line 6).
    planted: /Place order/,
  },
] as const;

describe("extraction replay against real Claude recordings", () => {
  for (const c of CASES) {
    const path = join(RECORDINGS, `${c.name}-1.json`);
    it.skipIf(!existsSync(path))(
      `${c.name}: same prompt, the real answer parses, and the planted requirement is found (record first: node scripts/record-extractions.mjs)`,
      async () => {
        const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
        const failed = FailedCall.safeParse(raw);
        if (failed.success)
          throw new Error(
            `${path} holds a failed call (${failed.data.result.error.code}: ${failed.data.result.error.message}), not an answer. Delete it and record again.`,
          );
        const recording = Recording.parse(raw);
        const text = readFileSync(join(FIXTURES, "sample-prds", c.file), "utf8");
        const ai = replay(recording);
        const result = await extractWithAi(
          { repoReader: inMemoryRepoReader({ prds: { [c.file]: text } }), aiProvider: ai },
          { prdFolder: "prds", files: [c.file], tally: newAiTally(), onProgress: () => undefined },
        );

        expect(ai.asked).toHaveLength(1);
        expect(ai.asked[0]?.system).toBe(recording.request.system);
        expect(ai.asked[0]?.user).toBe(recording.request.user);
        expect(ai.asked[0]?.jsonSchema).toStrictEqual(recording.request.jsonSchema);
        expect(result.warnings).toStrictEqual([]);
        expect(result.stoppedBy).toBeNull();
        // Every kept item quotes the PRD as written (the parser verified it); the planted one is among them.
        const kept = [
          ...result.requirements.map((r) => r.extraction?.quote.snippet ?? ""),
          ...result.needsReview.map((r) => r.quote.snippet),
        ];
        expect(kept.some((q) => c.planted.test(q))).toBe(true);
        // Compared as the evidence rule does: whitespace runs count as one space.
        const flat = (t: string) => t.replace(/\s+/g, " ").trim();
        for (const q of kept) expect(flat(text)).toContain(flat(q));
      },
    );
  }
});

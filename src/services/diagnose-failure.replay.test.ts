import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ok } from "../core/domain/result.ts";
import { Finding } from "../core/domain/finding.ts";
import { Run } from "../core/domain/run.ts";
import type { AiProvider, AiRequest } from "../core/ports/ai-provider.ts";
import { NOT_IMPLEMENTED_NOTE, setupProjectNote } from "../core/rules/diagnosis.ts";
import { redactSecrets } from "../core/rules/redaction.ts";
import { diagnoseFailure } from "./diagnose-failure.ts";
import { inMemoryRepoReader } from "./testing/in-memory-repo-reader.ts";

// Offline replay of the real Claude recordings (fixtures/diagnosis/README.md): the prompt built today from the saved
// run, spec and sample shop must be byte-for-byte the one Claude answered, and that real answer must still parse
// into the same diagnosis. A prompt change fails here until the recordings are made again.
const FIXTURES = join(import.meta.dirname, "../../fixtures");
const RECORDINGS = join(FIXTURES, "recorded/claude-diagnosis");
const { findings } = z
  .object({ findings: z.array(Finding) })
  .parse(JSON.parse(readFileSync(join(FIXTURES, "baselines/m1-scan-result.json"), "utf8")));

function filesUnder(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const path = join(d, name);
      if (statSync(path).isDirectory()) walk(path);
      else files[relative(dir, path)] = readFileSync(path, "utf8");
    }
  };
  walk(dir);
  return files;
}
const sampleShop = filesUnder(join(FIXTURES, "sample-repo"));

// A recording as recordingAiProvider saves it: the exact request, and the answer Claude gave.
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
const readRecording = (name: string): Recording =>
  Recording.parse(JSON.parse(readFileSync(join(RECORDINGS, `${name}-1.json`), "utf8")));

/** Answers with the recorded result, and keeps the request it was actually given. */
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
    name: "app-bug-cart-1-2",
    spec: "cart-1-2-discount-codes-are-case-insensitive-save10.spec.ts",
    expected: {
      likelyCause: "app_bug",
      confidence: 0.95,
      redactions: 0,
      notes: [],
      reviewStatus: "confirmed",
    },
  },
  {
    name: "test-bug-cart-1-1",
    spec: "cart-1-1-add-to-basket.spec.ts",
    expected: {
      likelyCause: "test_bug",
      confidence: 0.95,
      redactions: 0,
      notes: [],
      reviewStatus: "confirmed",
    },
  },
  {
    name: "environment-account-3-1",
    spec: "account-3-1-order-history.spec.ts",
    // The model named the missing feature as the root cause; AutoAI adds both facts it knows for certain.
    expected: {
      likelyCause: "app_bug",
      confidence: 0.8,
      redactions: 1,
      notes: [NOT_IMPLEMENTED_NOTE, setupProjectNote(["login"])],
      // Confident, but a skipped login setup may explain it: shown as a possible cause (rule, not AI).
      reviewStatus: "needs_review",
    },
  },
] as const;

describe("diagnosis replay against real Claude recordings", () => {
  it.each(CASES)(
    "$name: same prompt, same answer, same diagnosis",
    async ({ name, spec, expected }) => {
      const recording = readRecording(name);
      const run = Run.parse(
        JSON.parse(
          readFileSync(join(FIXTURES, "diagnosis/runs", `${name}.json`), "utf8").replaceAll(
            "<repo>",
            "/repo",
          ),
        ),
      );
      const repo = {
        ...sampleShop,
        [`tests/autoai/${spec}`]: readFileSync(join(FIXTURES, "diagnosis/specs", spec), "utf8"),
      };
      const ai = replay(recording);

      const result = await diagnoseFailure(
        { repoReader: inMemoryRepoReader({ "/repo": repo }), aiProvider: ai },
        { run, findings },
      );

      expect(ai.asked).toHaveLength(1);
      expect(ai.asked[0]?.system).toBe(recording.request.system);
      expect(ai.asked[0]?.user).toBe(recording.request.user);
      expect(ai.asked[0]?.jsonSchema).toStrictEqual(recording.request.jsonSchema);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.diagnosis).toMatchObject({
        likelyCause: expected.likelyCause,
        confidence: expected.confidence,
        reviewStatus: expected.reviewStatus,
        notes: expected.notes,
      });
      expect(result.value.redactions).toBe(expected.redactions);
    },
  );

  it("no recording contains a secret: every prompt was redacted before it was sent", () => {
    for (const { name } of CASES) {
      const recording = readRecording(name);
      expect(redactSecrets(recording.request.user).count, name).toBe(0);
    }
    const env = readFileSync(join(RECORDINGS, "environment-account-3-1-1.json"), "utf8");
    expect(env).toContain("/account?session=[REDACTED]");
    expect(env).not.toContain("d41d8cd98f00b204e980");
  });
});

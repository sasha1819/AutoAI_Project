import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { RunId } from "../core/domain/ids.ts";
import type { AttemptReport, Run } from "../core/domain/run.ts";
import type { AiError } from "../core/ports/ai-provider.ts";
import { inMemoryRepoReader } from "../services/testing/in-memory-repo-reader.ts";
import { scriptedAiProvider } from "../services/testing/scripted-ai-provider.ts";
import { recordDiagnosis } from "./record-diagnosis.ts";

const SPEC = "tests/autoai/cart-1-2.spec.ts";
const failed: AttemptReport = {
  result: "failed",
  durationMs: 5000,
  steps: [],
  failure: { step: "Expect visible", error: "Error: expect failed", pageSnapshot: "- status: x" },
};
const run = (over: Partial<Run> = {}): Run => ({
  runId: RunId.parse("run-1"),
  repoRoot: "/repo",
  specPath: SPEC,
  status: "failed",
  attempts: [failed, failed],
  ...over,
});
const repo = {
  [SPEC]:
    '// AutoAI requirement: Cart 1.2\nimport { expect, test } from "@playwright/test";\ntest("x", async () => {});',
  "src/cart/discounts.js": "export function findDiscount(code) { return codes.get(code); }",
};
// A real answer shape (fixtures/recorded/claude-diagnosis), so success parses.
const realAnswer = z
  .object({ result: z.object({ value: z.object({ text: z.string() }) }) })
  .parse(
    JSON.parse(
      readFileSync(
        join(
          import.meta.dirname,
          "../../fixtures/recorded/claude-diagnosis/app-bug-cart-1-2-1.json",
        ),
        "utf8",
      ),
    ),
  ).result.value.text;

const folder = () => {
  const dir = mkdtempSync(join(tmpdir(), "autoai-diagnosis-recordings-"));
  writeFileSync(join(dir, "case-1.json"), "OLD");
  writeFileSync(join(dir, "other-1.json"), "OTHER");
  return dir;
};
const record = (
  script: (string | AiError)[],
  dir: string,
  over: { run?: Run; files?: Record<string, string> } = {},
) =>
  recordDiagnosis(
    {
      aiProvider: scriptedAiProvider(...script),
      repoReader: inMemoryRepoReader({ "/repo": over.files ?? repo }),
    },
    { run: over.run ?? run(), findings: [], recordingsDir: dir, name: "case" },
  );
const unchanged = (dir: string) => {
  expect(readdirSync(dir).sort()).toStrictEqual(["case-1.json", "other-1.json"]);
  expect(readFileSync(join(dir, "case-1.json"), "utf8")).toBe("OLD");
};

describe("recordDiagnosis: nothing is saved unless the diagnosis succeeded", () => {
  it.each<[string, AiError]>([
    [
      "a rejected key",
      { code: "AI_AUTH_FAILED", message: "The Anthropic API rejected the API key." },
    ],
    ["a rate limit", { code: "AI_RATE_LIMITED", message: "429" }],
    ["an outage", { code: "AI_UNAVAILABLE", message: "overloaded" }],
    ["an unknown model", { code: "AI_MODEL_NOT_FOUND", message: "no such model" }],
    ["a refusal", { code: "AI_REFUSED", message: "refused" }],
    ["a cut-off answer", { code: "AI_OUTPUT_TRUNCATED", message: "max_tokens" }],
  ])("%s: fails with its code and message; old recordings kept", async (_, error) => {
    const dir = folder();
    const result = await record([error], dir);
    expect(result).toStrictEqual({ ok: false, error });
    unchanged(dir);
  });

  it("an answer that stays invalid: INVALID_AI_OUTPUT, nothing saved", async () => {
    const dir = folder();
    const result = await record(["not json", "still not json"], dir);
    expect(result.ok ? null : result.error.code).toBe("INVALID_AI_OUTPUT");
    unchanged(dir);
  });

  it("an unreadable spec (no AI call): its code, nothing saved", async () => {
    const dir = folder();
    const result = await record([], dir, { files: {} });
    expect(result.ok ? null : result.error.code).toBe("PATH_NOT_FOUND");
    unchanged(dir);
  });

  it("a run that is not a confirmed failure (no AI call): its code, nothing saved", async () => {
    const dir = folder();
    const result = await record([], dir, { run: run({ status: "passed", attempts: [] }) });
    expect(result.ok).toBe(false);
    unchanged(dir);
  });

  it("success replaces this case's recording and keeps the others", async () => {
    const dir = folder();
    const result = await record([realAnswer], dir);
    expect(result.ok).toBe(true);
    expect(readdirSync(dir).sort()).toStrictEqual(["case-1.json", "other-1.json"]);
    expect(readFileSync(join(dir, "case-1.json"), "utf8")).not.toBe("OLD");
    expect(readFileSync(join(dir, "other-1.json"), "utf8")).toBe("OTHER");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Confidence, type Finding } from "../core/domain/finding.ts";
import { RunId } from "../core/domain/ids.ts";
import type { AttemptReport, Run } from "../core/domain/run.ts";
import { setupProjectNote } from "../core/rules/diagnosis.ts";
import { diagnoseFailure } from "./diagnose-failure.ts";
import { inMemoryRepoReader } from "./testing/in-memory-repo-reader.ts";
import { scriptedAiProvider } from "./testing/scripted-ai-provider.ts";

const SPEC = "tests/autoai/cart-1-2.spec.ts";
const failedAttempt = (
  over: Partial<Extract<AttemptReport, { result: "failed" }>["failure"]> = {},
): AttemptReport => ({
  result: "failed",
  durationMs: 5000,
  steps: [],
  failure: {
    step: "Expect \"not toBeVisible\" getByText('Unknown discount code')",
    error: "Error: expect(locator).not.toBeVisible() failed",
    pageSnapshot: "- status: Unknown discount code",
    ...over,
  },
});
const run = (over: Partial<Run> = {}): Run => ({
  runId: RunId.parse("run-1"),
  repoRoot: "/repo",
  specPath: SPEC,
  status: "failed",
  attempts: [failedAttempt(), failedAttempt()],
  ...over,
});
const repo = {
  [SPEC]:
    '// AutoAI requirement: Cart 1.2\nimport { expect, test } from "@playwright/test";\ntest("x", async ({ page }) => {});',
  "src/cart/discounts.js": "export function findDiscount(code) { return codes.get(code); }",
  "src/catalog.js": "export const products = [];",
};
const finding: Finding = {
  requirement: {
    tag: "Cart 1.2",
    area: "Cart",
    text: "Discount codes are case-insensitive.",
    source: { file: "shop.md", line: 9 },
  },
  type: "mismatch",
  severity: "medium",
  explanation: "findDiscount compares the code exactly.",
  evidence: null,
  confidence: Confidence.parse(0.9),
  reviewStatus: "confirmed",
  reviewReasons: [],
};
// Claude's real answer to the Cart 1.2 failure (fixtures/recorded/claude-diagnosis); tests change single fields.
const Recording = z.object({ result: z.object({ value: z.object({ text: z.string() }) }) });
const RealAnswer = z.object({ explanation: z.string(), suggestedFix: z.string() }).loose();
const recorded = Recording.parse(
  JSON.parse(
    readFileSync(
      join(import.meta.dirname, "../../fixtures/recorded/claude-diagnosis/app-bug-cart-1-2-1.json"),
      "utf8",
    ),
  ),
).result.value.text;
const real = RealAnswer.parse(JSON.parse(recorded));
const answer = (over: Record<string, unknown> = {}) => JSON.stringify({ ...real, ...over });

describe("diagnoseFailure", () => {
  it.each<[string, Run]>([
    [
      "passed",
      run({ status: "passed", attempts: [{ result: "passed", durationMs: 1, steps: [] }] }),
    ],
    [
      "flaky",
      run({
        status: "flaky",
        attempts: [failedAttempt(), { result: "passed", durationMs: 1, steps: [] }],
      }),
    ],
  ])("never sends a %s run to the AI", async (_status, saved) => {
    const ai = scriptedAiProvider();
    const result = await diagnoseFailure(
      { repoReader: inMemoryRepoReader({ "/repo": repo }), aiProvider: ai },
      { run: saved, findings: [] },
    );
    expect(result.ok || result.error.code).toBe("NOT_A_CONFIRMED_FAILURE");
    expect(ai.requests).toHaveLength(0);
  });

  it.each<[string, Run]>([
    [
      "a failed run whose last attempt passed",
      run({ attempts: [failedAttempt(), { result: "passed", durationMs: 1, steps: [] }] }),
    ],
    ["a failed run that was never retried", run({ attempts: [failedAttempt()] })],
    ["a passed run with two failures", run({ status: "passed" })],
  ])(
    "refuses %s as INCONSISTENT_RUN (a saved file's status is checked, not trusted)",
    async (_name, saved) => {
      const ai = scriptedAiProvider();
      const result = await diagnoseFailure(
        { repoReader: inMemoryRepoReader({ "/repo": repo }), aiProvider: ai },
        { run: saved, findings: [] },
      );
      expect(result.ok || result.error.code).toBe("INCONSISTENT_RUN");
      expect(ai.requests).toHaveLength(0);
    },
  );

  it("diagnoses a confirmed failure with the requirement and its most relevant code", async () => {
    const ai = scriptedAiProvider(answer());
    const result = await diagnoseFailure(
      { repoReader: inMemoryRepoReader({ "/repo": repo }), aiProvider: ai },
      { run: run(), findings: [finding] },
    );
    expect(result).toStrictEqual({
      ok: true,
      value: {
        runId: "run-1",
        specPath: SPEC,
        diagnosis: {
          explanation: real.explanation,
          likelyCause: "app_bug",
          suggestedFix: real.suggestedFix,
          confidence: 0.95,
          reviewStatus: "confirmed",
          notes: [],
        },
        redactions: 0,
        model: "claude-sonnet-5",
        usage: { aiCalls: 1, inputTokens: 100, outputTokens: 20 },
      },
    });
    const user = ai.requests[0]?.user ?? "";
    expect(user).toContain('<requirement tag="Cart 1.2"');
    expect(user).toContain('<file path="src/cart/discounts.js">');
    expect(user).not.toContain('<file path="src/catalog.js">');
  });

  it("without a matching scan finding, shows only the test and the failure", async () => {
    const ai = scriptedAiProvider(answer({ likelyCause: "unclear", confidence: 0.4 }));
    const result = await diagnoseFailure(
      { repoReader: inMemoryRepoReader({ "/repo": repo }), aiProvider: ai },
      {
        run: run(),
        findings: [{ ...finding, requirement: { ...finding.requirement, tag: "Other 9" } }],
      },
    );
    expect(result.ok && result.value.diagnosis.reviewStatus).toBe("needs_review");
    expect(ai.requests[0]?.user).toContain("(no app code shown)");
  });

  it("hides secrets from the spec, the capture and the app code before anything reaches the AI", async () => {
    const secrets = [
      "hunter2-SECRET",
      "sk-live-TOKENVALUE123",
      "abc.def.ghi",
      "s3cr3t-cookie",
      "tok-in-url",
    ];
    const leakyRepo = {
      ...repo,
      [SPEC]: `${repo[SPEC]}\nawait page.getByLabel("Password").fill("hunter2-SECRET");\nawait page.goto("/reset?token=tok-in-url");`,
      "src/cart/discounts.js":
        'const API_KEY = "sk-live-TOKENVALUE123"; export function findDiscount() {}',
    };
    const ai = scriptedAiProvider(answer());
    const result = await diagnoseFailure(
      { repoReader: inMemoryRepoReader({ "/repo": leakyRepo }), aiProvider: ai },
      {
        run: run({
          attempts: [
            failedAttempt({ step: "Fill getByLabel('Password')" }),
            failedAttempt({
              error:
                "Error: request failed\nAuthorization: Bearer abc.def.ghi\ncookie: sid=s3cr3t-cookie",
              pageSnapshot: '- textbox "Password" [ref=e5]: hunter2-SECRET',
            }),
          ],
        }),
        findings: [finding],
      },
    );
    const sent = JSON.stringify(ai.requests);
    for (const secret of secrets) expect(sent).not.toContain(secret);
    expect(result.ok && result.value.redactions).toBe(6);
  });

  it("always notes setup projects the runner skipped", async () => {
    const ai = scriptedAiProvider(answer({ likelyCause: "environment" }));
    const result = await diagnoseFailure(
      { repoReader: inMemoryRepoReader({ "/repo": repo }), aiProvider: ai },
      {
        run: run({
          attempts: [failedAttempt(), failedAttempt({ skippedSetupProjects: ["login"] })],
        }),
        findings: [],
      },
    );
    expect(result.ok && result.value.diagnosis.notes).toStrictEqual([setupProjectNote(["login"])]);
    expect(ai.requests[0]?.user).toContain(
      "<setup_projects_not_run>\nlogin\n</setup_projects_not_run>",
    );
  });

  it("asks again once after an invalid answer, then gives up with INVALID_AI_OUTPUT", async () => {
    const ai = scriptedAiProvider("not json", answer());
    const fixed = await diagnoseFailure(
      { repoReader: inMemoryRepoReader({ "/repo": repo }), aiProvider: ai },
      { run: run(), findings: [] },
    );
    expect(fixed.ok && fixed.value.usage.aiCalls).toBe(2);

    const twice = await diagnoseFailure(
      {
        repoReader: inMemoryRepoReader({ "/repo": repo }),
        aiProvider: scriptedAiProvider("no", "nope"),
      },
      { run: run(), findings: [] },
    );
    expect(twice.ok || twice.error.code).toBe("INVALID_AI_OUTPUT");
  });

  it("passes AI and repo errors through", async () => {
    const aiDown = await diagnoseFailure(
      {
        repoReader: inMemoryRepoReader({ "/repo": repo }),
        aiProvider: scriptedAiProvider({ code: "AI_AUTH_FAILED", message: "bad key" }),
      },
      { run: run(), findings: [] },
    );
    expect(aiDown.ok || aiDown.error.code).toBe("AI_AUTH_FAILED");

    const noSpec = await diagnoseFailure(
      { repoReader: inMemoryRepoReader({ "/repo": {} }), aiProvider: scriptedAiProvider() },
      { run: run(), findings: [] },
    );
    expect(noSpec.ok || noSpec.error.code).toBe("PATH_NOT_FOUND");
  });
});

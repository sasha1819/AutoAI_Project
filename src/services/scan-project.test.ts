import { describe, expect, it } from "vitest";
import { ScanProgress } from "../core/domain/scan-progress.ts";
import type { AiError } from "../core/ports/ai-provider.ts";
import { scanProject } from "./scan-project.ts";
import { inMemoryRepoReader } from "./testing/in-memory-repo-reader.ts";
import { scriptedAiProvider } from "./testing/scripted-ai-provider.ts";

const repo = {
  "src/cart/discounts.js": [
    'const codes = new Map([["SAVE10", 0.1]]);',
    "",
    "export function findDiscount(input) {",
    "  const code = input.trim();",
    "  const rate = codes.get(code);",
    "  return rate === undefined ? null : { code, rate };",
    "}",
  ].join("\n"),
  "src/checkout/shipping.js":
    "export function shippingFee(subtotal) {\n  return subtotal > 50 ? 0 : 5;\n}",
  "README.md": "Discount codes and shipping.",
};
const prds = {
  "shop.md": [
    "## Cart",
    "",
    "Cart 1.2: Discount codes are case-insensitive.",
    "",
    "Cart 1.3: Removing the last item shows an empty-cart message.",
    "",
    "## Shipping",
    "",
    "Shipping 2.1: Orders of $50 or more ship free.",
  ].join("\n"),
};
const input = { repoRoot: "repo", prdFolder: "prds" };

type Answer = {
  requirement: string;
  type: string;
  severity: string | null;
  evidence?: object | null;
};
const answer = (...findings: Answer[]) =>
  JSON.stringify({
    findings: findings.map((f) => ({
      explanation: "One plain sentence.",
      confidence: 0.9,
      evidence: null,
      ...f,
    })),
  });
const cartAnswer = answer(
  {
    requirement: "R1",
    type: "mismatch",
    severity: "medium",
    evidence: { file: "src/cart/discounts.js", lines: [5, 5], snippet: "codes.get(code)" },
  },
  { requirement: "R2", type: "not_implemented", severity: "low" },
);
const shippingAnswer = answer({
  requirement: "R1",
  type: "mismatch",
  severity: "high",
  evidence: { file: "src/checkout/shipping.js", lines: [2, 2], snippet: "subtotal > 50 ? 0 : 5" },
});
const authFailed: AiError = { code: "AI_AUTH_FAILED", message: "rejected" };

describe("scanProject", () => {
  it("batches by area, sends relevant code, and returns reviewed findings with the total usage", async () => {
    const ai = scriptedAiProvider(cartAnswer, shippingAnswer);
    const result = await scanProject(
      { repoReader: inMemoryRepoReader({ repo, prds }), aiProvider: ai },
      input,
    );
    if (!result.ok) throw new Error(result.error.message);
    const scan = result.value;

    expect(
      scan.findings.map((f) => [f.requirement.tag, f.type, f.severity, f.reviewStatus]),
    ).toStrictEqual([
      ["Cart 1.2", "mismatch", "medium", "confirmed"],
      ["Cart 1.3", "not_implemented", "low", "confirmed"],
      ["Shipping 2.1", "mismatch", "high", "confirmed"],
    ]);
    expect(scan.usage).toStrictEqual({ aiCalls: 2, inputTokens: 200, outputTokens: 40 });
    expect(scan.models).toStrictEqual(["claude-sonnet-5"]);
    expect([scan.warnings, scan.notScanned, scan.stoppedBy]).toStrictEqual([[], [], null]);
    expect([scan.prdFiles, scan.sourceFiles]).toStrictEqual([["shop.md"], 2]);

    const [cart, shipping] = ai.requests;
    expect(cart?.user).toContain('<file path="src/cart/discounts.js">');
    expect(cart?.user).toContain('tag="Cart 1.3"');
    expect(shipping?.user).toContain('<file path="src/checkout/shipping.js">');
    expect(shipping?.user).not.toContain("Cart 1.2");
    expect(ai.requests.every((r) => !r.user.includes("README.md"))).toBe(true);
    expect(JSON.stringify(cart?.jsonSchema)).toContain('"enum":["R1","R2"]');
  });

  it("reports its progress stage by stage, one matching event per area", async () => {
    const seen: ScanProgress[] = [];
    await scanProject(
      {
        repoReader: inMemoryRepoReader({ repo, prds }),
        aiProvider: scriptedAiProvider(cartAnswer, shippingAnswer),
      },
      { ...input, onProgress: (p) => seen.push(p) },
    );
    expect(seen).toStrictEqual([
      { stage: "reading_prds" },
      { stage: "prds_read", prdFiles: 1, requirements: 3 },
      { stage: "reading_code" },
      { stage: "code_read", sourceFiles: 2 },
      { stage: "matching", area: "Cart", batch: 1, batches: 2 },
      { stage: "matching", area: "Shipping", batch: 2, batches: 2 },
      { stage: "done" },
    ]);
    for (const p of seen) expect(ScanProgress.safeParse(p).success).toBe(true);
  });

  it("stops reporting matching once an AI error stops the scan", async () => {
    const seen: ScanProgress[] = [];
    await scanProject(
      {
        repoReader: inMemoryRepoReader({ repo, prds }),
        aiProvider: scriptedAiProvider(authFailed),
      },
      { ...input, onProgress: (p) => seen.push(p) },
    );
    expect(seen.filter((p) => p.stage === "matching")).toHaveLength(1);
    expect(seen.at(-1)).toStrictEqual({ stage: "done" });
  });

  it("retries once when an answer fails validation", async () => {
    const ai = scriptedAiProvider("not json at all", cartAnswer, shippingAnswer);
    const result = await scanProject(
      { repoReader: inMemoryRepoReader({ repo, prds }), aiProvider: ai },
      input,
    );
    expect(result.ok && result.value.findings).toHaveLength(3);
    expect(result.ok && result.value.usage.aiCalls).toBe(3);
  });

  it("marks a batch not scanned after two invalid answers, and keeps scanning the others", async () => {
    const ai = scriptedAiProvider("nope", '{"findings": []}', shippingAnswer);
    const result = await scanProject(
      { repoReader: inMemoryRepoReader({ repo, prds }), aiProvider: ai },
      input,
    );
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.notScanned.map((r) => r.tag)).toStrictEqual(["Cart 1.2", "Cart 1.3"]);
    expect(result.value.findings.map((f) => f.requirement.tag)).toStrictEqual(["Shipping 2.1"]);
    expect(result.value.warnings).toStrictEqual([
      {
        code: "BATCH_NOT_SCANNED",
        message: expect.stringMatching(/^Cart: .*no finding for R1/) as unknown,
      },
    ]);
  });

  it("stops at an AI error but keeps what it already paid for", async () => {
    const ai = scriptedAiProvider(cartAnswer, authFailed);
    const result = await scanProject(
      { repoReader: inMemoryRepoReader({ repo, prds }), aiProvider: ai },
      input,
    );
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.stoppedBy).toStrictEqual(authFailed);
    expect(result.value.findings.map((f) => f.requirement.tag)).toStrictEqual([
      "Cart 1.2",
      "Cart 1.3",
    ]);
    expect(result.value.notScanned.map((r) => r.tag)).toStrictEqual(["Shipping 2.1"]);
  });

  it.each<AiError["code"]>(["AI_OUTPUT_TRUNCATED", "AI_REFUSED", "AI_BAD_REQUEST"])(
    "skips only the batch when one prompt fails with %s, and scans the rest",
    async (code) => {
      const ai = scriptedAiProvider({ code, message: "that prompt failed" }, shippingAnswer);
      const result = await scanProject(
        { repoReader: inMemoryRepoReader({ repo, prds }), aiProvider: ai },
        input,
      );
      if (!result.ok) throw new Error(result.error.message);
      expect(result.value.stoppedBy).toBeNull();
      expect(result.value.findings.map((f) => f.requirement.tag)).toStrictEqual(["Shipping 2.1"]);
      expect(result.value.notScanned.map((r) => r.tag)).toStrictEqual(["Cart 1.2", "Cart 1.3"]);
      expect(result.value.warnings).toStrictEqual([
        { code: "BATCH_NOT_SCANNED", message: `Cart: ${code}: that prompt failed` },
      ]);
      expect(ai.requests).toHaveLength(2);
    },
  );

  it("makes no further AI calls after an AI error", async () => {
    const ai = scriptedAiProvider(authFailed);
    const result = await scanProject(
      { repoReader: inMemoryRepoReader({ repo, prds }), aiProvider: ai },
      input,
    );
    expect(ai.requests).toHaveLength(1);
    expect(result.ok && result.value.notScanned).toHaveLength(3);
  });

  it("scans nothing and calls no AI when there are no PRD files (PRD onboarding edge case)", async () => {
    const ai = scriptedAiProvider();
    const reader = inMemoryRepoReader({ repo, prds: { "logo.png": "x" } });
    const result = await scanProject({ repoReader: reader, aiProvider: ai }, input);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.warnings.map((w) => w.code)).toStrictEqual(["NO_PRD_FILES"]);
    expect([result.value.requirements, result.value.findings, ai.requests]).toStrictEqual([
      [],
      [],
      [],
    ]);
    expect(reader.calls.filter((c) => c.startsWith("read repo"))).toStrictEqual([]);
  });

  it("no PRD folder at all: the same as an empty one (no AI, a warning)", async () => {
    const ai = scriptedAiProvider();
    const result = await scanProject(
      { repoReader: inMemoryRepoReader({ repo, prds }), aiProvider: ai },
      { repoRoot: "repo", prdFolder: null },
    );
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.warnings.map((w) => w.code)).toStrictEqual(["NO_PRD_FILES"]);
    expect(ai.requests).toStrictEqual([]);
  });

  it("skips an unreadable source file with a warning", async () => {
    const reader = inMemoryRepoReader(
      { repo, prds },
      { read: { "src/checkout/shipping.js": { code: "PATH_UNREADABLE", message: "denied" } } },
    );
    const ai = scriptedAiProvider(
      cartAnswer,
      answer({ requirement: "R1", type: "not_implemented", severity: "high" }),
    );
    const result = await scanProject({ repoReader: reader, aiProvider: ai }, input);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.warnings).toStrictEqual([
      { code: "SOURCE_FILE_UNREADABLE", message: "src/checkout/shipping.js: denied" },
    ]);
    expect(result.value.sourceFiles).toBe(2);
  });

  it.each([
    ["the PRD folder is missing", { repo }, "PATH_NOT_FOUND"],
    ["the repo folder is missing", { prds }, "PATH_NOT_FOUND"],
  ])("fails when %s", async (_name, roots, code) => {
    const result = await scanProject(
      { repoReader: inMemoryRepoReader(roots), aiProvider: scriptedAiProvider() },
      input,
    );
    expect(result.ok ? null : result.error.code).toBe(code);
  });
});

describe("scanProject with a plain-prose PRD (ADR 0008)", () => {
  const vision = [
    "Our shop vision",
    "",
    "Shoppers can apply the discount code SAVE10 at checkout.",
    "We would like checkout to feel friendly and calm.",
    "Orders of $50 or more ship free.",
  ].join("\n");
  const extracted = JSON.stringify({
    requirements: [
      {
        area: "Cart",
        text: "The discount code SAVE10 can be applied at checkout.",
        quote: {
          lines: [3, 3],
          snippet: "Shoppers can apply the discount code SAVE10 at checkout.",
        },
        confidence: 0.9,
      },
      {
        area: "Checkout",
        text: "Checkout feels friendly and calm.",
        quote: { lines: [4, 4], snippet: "We would like checkout to feel friendly and calm." },
        confidence: 0.4,
      },
      {
        area: "Shipping",
        text: "Shipping is free for every order.",
        quote: { lines: [5, 5], snippet: "Every order ships free of charge." },
        confidence: 0.95,
      },
    ],
  });
  const matched = answer({ requirement: "R1", type: "match", severity: null });

  it("a needs-review requirement never reaches the matcher; a dropped one is nowhere", async () => {
    const ai = scriptedAiProvider(extracted, matched);
    const result = await scanProject(
      { repoReader: inMemoryRepoReader({ repo, prds: { "vision.md": vision } }), aiProvider: ai },
      input,
    );
    if (!result.ok) throw new Error(result.error.message);
    const [extraction, matching] = ai.requests;
    expect(extraction?.user).toContain('<prd file="vision.md">');
    expect(ai.requests).toHaveLength(2);

    // Compared: only the verified, confident one.
    expect(matching?.user).toContain("The discount code SAVE10 can be applied at checkout.");
    expect(matching?.user).toContain('tag="Cart (AI) 1"');
    // Needs review: listed for the user, never in a matching prompt.
    expect(ai.requests.slice(1).some((r) => r.user.includes("friendly and calm"))).toBe(false);
    expect(result.value.needsReview.map((c) => c.text)).toStrictEqual([
      "Checkout feels friendly and calm.",
    ]);
    // Dropped (quote not in the PRD): neither compared nor listed, only counted.
    expect(JSON.stringify(ai.requests.slice(1))).not.toContain("Shipping is free for every order");
    expect(JSON.stringify(result.value.needsReview)).not.toContain("Shipping is free");
    expect(result.value.extraction).toStrictEqual({ files: 1, dropped: 1 });

    expect(result.value.requirements.map((r) => r.tag)).toStrictEqual(["Cart (AI) 1"]);
    expect(result.value.findings.map((f) => f.requirement.tag)).toStrictEqual(["Cart (AI) 1"]);
    expect(result.value.usage.aiCalls).toBe(2);
  });

  it("reports extraction progress between reading the PRDs and reading the code", async () => {
    const stages: string[] = [];
    await scanProject(
      {
        repoReader: inMemoryRepoReader({ repo, prds: { "vision.md": vision } }),
        aiProvider: scriptedAiProvider(extracted, matched),
      },
      { ...input, onProgress: (p) => stages.push(p.stage) },
    );
    expect(stages.slice(0, 5)).toStrictEqual([
      "reading_prds",
      "prds_read",
      "extracting",
      "extracted",
      "reading_code",
    ]);
  });

  it("a PRD over the size cap is not sent to Claude, and the scan says so", async () => {
    const ai = scriptedAiProvider();
    const result = await scanProject(
      {
        repoReader: inMemoryRepoReader({ repo, prds: { "huge.md": "words ".repeat(20000) } }),
        aiProvider: ai,
      },
      input,
    );
    if (!result.ok) throw new Error(result.error.message);
    expect(ai.requests).toHaveLength(0);
    expect(result.value.warnings.map((w) => w.code)).toContain("PRD_TOO_LARGE");
  });

  it("a structured PRD is never sent to Claude for extraction", async () => {
    const ai = scriptedAiProvider(
      cartAnswer,
      answer({ requirement: "R1", type: "match", severity: null }),
    );
    await scanProject({ repoReader: inMemoryRepoReader({ repo, prds }), aiProvider: ai }, input);
    expect(ai.requests.some((r) => r.user.includes("<prd file="))).toBe(false);
  });

  it("an AI error that stops extraction stops the scan before matching", async () => {
    const ai = scriptedAiProvider({ code: "AI_AUTH_FAILED", message: "401" });
    const result = await scanProject(
      { repoReader: inMemoryRepoReader({ repo, prds: { "vision.md": vision } }), aiProvider: ai },
      input,
    );
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.stoppedBy?.code).toBe("AI_AUTH_FAILED");
    expect(ai.requests).toHaveLength(1);
    // Stopped on the first file: none was read, and the report does not claim otherwise.
    expect(result.value.extraction.files).toBe(0);
  });
});

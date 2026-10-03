import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inMemoryRepoReader } from "../services/testing/in-memory-repo-reader.ts";
import { scriptedAiProvider } from "../services/testing/scripted-ai-provider.ts";
import { recordExtraction } from "./record-extraction.ts";

const prd = "Shop\n\nThe checkout button stays disabled until the cart has an item.";
const good = JSON.stringify({
  requirements: [
    {
      area: "Checkout",
      text: "Checkout is disabled while the cart is empty.",
      quote: {
        lines: [3, 3],
        snippet: "The checkout button stays disabled until the cart has an item.",
      },
      confidence: 0.9,
    },
  ],
});
const setup = () => {
  const dir = mkdtempSync(join(tmpdir(), "autoai-recordings-"));
  // An earlier good recording that a failed run must leave alone.
  writeFileSync(join(dir, "checkout-1.json"), "OLD");
  return dir;
};
const record = (ai: ReturnType<typeof scriptedAiProvider>, recordingsDir: string) =>
  recordExtraction(
    { aiProvider: ai, repoReader: inMemoryRepoReader({ prds: { "checkout.md": prd } }) },
    { prdFolder: "prds", file: "checkout.md", recordingsDir, name: "checkout" },
  );

describe("recordExtraction", () => {
  it.each([
    [
      "a rejected key",
      { code: "AI_AUTH_FAILED", message: "The Anthropic API rejected the API key." },
      "AI_AUTH_FAILED",
    ],
    ["a rate limit", { code: "AI_RATE_LIMITED", message: "429" }, "AI_RATE_LIMITED"],
    ["a refusal", { code: "AI_REFUSED", message: "refused" }, "EXTRACTION_FAILED"],
  ] as const)(
    "%s: fails with its code and message, and the folder is unchanged",
    async (_, error, code) => {
      const dir = setup();
      const result = await record(scriptedAiProvider(error), dir);
      expect(result.ok ? null : result.error.code).toBe(code);
      expect(result.ok ? null : result.error.message).toContain(error.message);
      expect(readdirSync(dir)).toStrictEqual(["checkout-1.json"]);
      expect(readFileSync(join(dir, "checkout-1.json"), "utf8")).toBe("OLD");
    },
  );

  it("an answer that stays invalid is not recorded either", async () => {
    const dir = setup();
    const result = await record(scriptedAiProvider("nonsense", "still nonsense"), dir);
    expect(result.ok ? null : result.error.code).toBe("EXTRACTION_FAILED");
    expect(readFileSync(join(dir, "checkout-1.json"), "utf8")).toBe("OLD");
  });

  it("a real answer replaces the old recording with the request and the successful result", async () => {
    const dir = setup();
    const result = await record(scriptedAiProvider(good), dir);
    expect(result.ok).toBe(true);
    expect(readdirSync(dir)).toStrictEqual(["checkout-1.json"]);
    const saved = JSON.parse(readFileSync(join(dir, "checkout-1.json"), "utf8")) as {
      request: { user: string };
      result: { ok: boolean; value: { text: string } };
    };
    expect(saved.result.ok).toBe(true);
    expect(saved.result.value.text).toBe(good);
    expect(saved.request.user).toContain('<prd file="checkout.md">');
  });

  it("creates the recordings folder on the first success only", async () => {
    const dir = join(mkdtempSync(join(tmpdir(), "autoai-recordings-")), "claude-extraction");
    const failed = await record(scriptedAiProvider({ code: "AI_AUTH_FAILED", message: "no" }), dir);
    expect(failed.ok).toBe(false);
    expect(() => readdirSync(dir)).toThrow();
    expect((await record(scriptedAiProvider(good), dir)).ok).toBe(true);
    expect(readdirSync(dir)).toStrictEqual(["checkout-1.json"]);
  });
});

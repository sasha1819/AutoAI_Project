import { describe, expect, it } from "vitest";
import { buildExtractionPrompt } from "../prompts/extraction.ts";
import { parseExtractionResponse } from "./extraction.ts";

const text = [
  "Sample Shop — Checkout requirements",
  "",
  "1. Placing an order",
  '   The "Place order" button stays disabled until the cart has at least one item.',
  "   Prices < 1 EUR & free items are shown as Free.",
].join("\n");
const prompt = buildExtractionPrompt({ path: "checkout.md", text });
const item = (over: Record<string, unknown> = {}) => ({
  area: "Checkout",
  text: "Place order is disabled while the cart is empty.",
  quote: {
    lines: [4, 4],
    snippet: 'The "Place order" button stays disabled until the cart has at least one item.',
  },
  confidence: 0.9,
  ...over,
});
const parse = (items: unknown[]) =>
  parseExtractionResponse(JSON.stringify({ requirements: items }), prompt);

describe("parseExtractionResponse (ADR 0008)", () => {
  it("a verified quote with confidence >= 0.7 becomes a requirement, tagged as Claude's", () => {
    const result = parse([item()]);
    expect(result).toStrictEqual({
      ok: true,
      value: {
        requirements: [
          {
            tag: "Checkout (AI) 1",
            area: "Checkout",
            text: "Place order is disabled while the cart is empty.",
            source: { file: "checkout.md", line: 4 },
            extraction: {
              confidence: 0.9,
              quote: {
                lines: [4, 4],
                snippet:
                  'The "Place order" button stays disabled until the cart has at least one item.',
              },
            },
          },
        ],
        needsReview: [],
        dropped: 0,
      },
    });
  });

  it("a verified quote below 0.7 needs review and is not a requirement", () => {
    const result = parse([item({ confidence: 0.5 })]);
    expect(result.ok && result.value.requirements).toStrictEqual([]);
    expect(
      result.ok && result.value.needsReview.map((c) => [c.text, c.confidence, c.source.line]),
    ).toStrictEqual([["Place order is disabled while the cart is empty.", 0.5, 4]]);
  });

  it.each([
    ["a snippet not in the file", { snippet: "The button is always enabled for guests." }],
    ["the right snippet at the wrong lines", { lines: [1, 1] }],
    ["a too-short snippet", { snippet: "Place" }],
  ])("%s is dropped completely, whatever the confidence", (_, quote) => {
    const result = parse([item({ quote: { ...item().quote, ...quote }, confidence: 0.99 })]);
    expect(
      result.ok && [
        result.value.requirements.length,
        result.value.needsReview.length,
        result.value.dropped,
      ],
    ).toStrictEqual([0, 0, 1]);
  });

  it("a quote with broken contents is dropped, not a parse failure", () => {
    const result = parse([item({ quote: { lines: [4], snippet: "" } })]);
    expect(result.ok && result.value.dropped).toBe(1);
  });

  it.each([null, undefined, "line 4"])(
    "an item without a quote (%j) is invalid output, asked for again (ADR 0008: no invention)",
    (quote) => {
      const result = parse([item({ quote })]);
      expect(result.ok ? null : result.error.code).toBe("INVALID_AI_OUTPUT");
    },
  );

  it("continues the per-area numbering from earlier files, so tags stay unique in a scan", () => {
    const result = parseExtractionResponse(
      JSON.stringify({ requirements: [item(), item({ area: "Cart" })] }),
      prompt,
      new Map([["Checkout", 2]]),
    );
    expect(result.ok && result.value.requirements.map((r) => r.tag)).toStrictEqual([
      "Checkout (AI) 3",
      "Cart (AI) 1",
    ]);
  });

  it("checks a quote of escaped text against the file as written", () => {
    const result = parse([
      item({
        quote: { lines: [5, 5], snippet: "Prices &lt; 1 EUR &amp; free items are shown as Free." },
      }),
    ]);
    expect(result.ok && result.value.requirements[0]?.extraction?.quote.snippet).toBe(
      "Prices < 1 EUR & free items are shown as Free.",
    );
  });

  it("numbers Claude's requirements per area", () => {
    const result = parse([item(), item({ area: "Cart" }), item()]);
    expect(result.ok && result.value.requirements.map((r) => r.tag)).toStrictEqual([
      "Checkout (AI) 1",
      "Cart (AI) 1",
      "Checkout (AI) 2",
    ]);
  });

  it("an empty list is a valid answer", () => {
    expect(parse([])).toStrictEqual({
      ok: true,
      value: { requirements: [], needsReview: [], dropped: 0 },
    });
  });

  it.each([
    ["not JSON", "no json here"],
    ["the wrong shape", JSON.stringify({ items: [] })],
    ["a confidence out of range", JSON.stringify({ requirements: [item({ confidence: 1.4 })] })],
    ["a blank text", JSON.stringify({ requirements: [item({ text: "  " })] })],
  ])("%s is INVALID_AI_OUTPUT", (_, raw) => {
    const result = parseExtractionResponse(raw, prompt);
    expect(result.ok ? null : result.error.code).toBe("INVALID_AI_OUTPUT");
  });
});

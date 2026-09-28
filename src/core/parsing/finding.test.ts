import { describe, expect, it } from "vitest";
import { Finding } from "../domain/finding.ts";
import type { Requirement } from "../domain/requirement.ts";
import { buildMatchingPrompt } from "../prompts/matching.ts";
import { parseMatchingResponse } from "./finding.ts";

// Hand-written replies in the exact shape the matching prompt asks for. Replace or extend with real recordings
// once the Claude adapter exists (tests never call the live API).
const cart12: Requirement = {
  tag: "Cart 1.2",
  area: "Cart",
  text: "Discount codes are case-insensitive.",
  source: { file: "shop.md", line: 9 },
};
const ship21: Requirement = {
  tag: "Shipping 2.1",
  area: "Shipping",
  text: "Orders of $50.00 or more ship free.",
  source: { file: "shop.md", line: 15 },
};
const files = [
  {
    path: "src/cart/discounts.js",
    text: [
      'const codes = new Map([["SAVE10", 0.1]]);',
      "",
      "export function findDiscount(input) {",
      "  const code = input.trim();",
      "  const rate = codes.get(code);",
      "  return rate === undefined ? null : { code, rate };",
      "}",
    ].join("\n"),
  },
  {
    path: "src/checkout/shipping.js",
    text: [
      "export const SHIPPING_FEE = 5;",
      "export const FREE_SHIPPING_FROM = 50;",
      "",
      "export function shippingFee(subtotal) {",
      "  if (subtotal === 0) return 0;",
      "  return subtotal > FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;",
      "}",
    ].join("\n"),
  },
];
const input = { requirements: [cart12, ship21], files };

const r1 = {
  requirement: "R1",
  type: "mismatch",
  severity: "medium",
  explanation: "src/cart/discounts.js looks the code up exactly as typed, so 'save10' is rejected.",
  evidence: { file: "src/cart/discounts.js", lines: [5, 5], snippet: "codes.get(code)" },
  confidence: 0.92,
};
const r2 = {
  requirement: "R2",
  type: "mismatch",
  severity: "high",
  explanation: "src/checkout/shipping.js only ships free above $50, so exactly $50 pays $5.",
  evidence: {
    file: "src/checkout/shipping.js",
    lines: [6, 6],
    snippet: "subtotal > FREE_SHIPPING_FROM",
  },
  confidence: 0.88,
};
const reply = (...findings: object[]) => JSON.stringify({ findings });
const prompt = buildMatchingPrompt({ ...input, omittedFiles: [], repoFiles: [] });
const parse = (raw: string) => parseMatchingResponse(raw, prompt);
const ok = (raw: string) => {
  const result = parse(raw);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe("parseMatchingResponse — valid replies", () => {
  it("turns each answer into a reviewed Finding tied to its requirement", () => {
    expect(ok(reply(r1, r2))).toStrictEqual([
      {
        requirement: cart12,
        type: "mismatch",
        severity: "medium",
        explanation: r1.explanation,
        evidence: r1.evidence,
        confidence: 0.92,
        reviewStatus: "confirmed",
        reviewReasons: [],
      },
      {
        requirement: ship21,
        type: "mismatch",
        severity: "high",
        explanation: r2.explanation,
        evidence: r2.evidence,
        confidence: 0.88,
        reviewStatus: "confirmed",
        reviewReasons: [],
      },
    ]);
  });

  it("produces values the domain Finding schema accepts", () => {
    for (const f of ok(reply(r1, r2))) expect(() => Finding.parse(f)).not.toThrow();
  });

  it("prefers the fenced JSON when the prose around it also has braces", () => {
    const raw = `I checked {every} file.\n\`\`\`json\n${reply(r1, r2)}\n\`\`\`\nSee {notes}.`;
    expect(ok(raw)).toHaveLength(2);
  });

  it("reads JSON wrapped in prose or a code fence, and orders findings like the requirements", () => {
    const raw = `Here is my analysis.\n\`\`\`json\n${reply(r2, r1)}\n\`\`\`\nLet me know!`;
    expect(ok(raw).map((f) => f.requirement.tag)).toStrictEqual(["Cart 1.2", "Shipping 2.1"]);
  });

  it.each<[string, object, string, string[]]>([
    ["low confidence", { ...r1, confidence: 0.4 }, "needs_review", ["LOW_CONFIDENCE"]],
    [
      "a mismatch with no evidence",
      { ...r1, evidence: null },
      "needs_review",
      ["MISSING_EVIDENCE"],
    ],
    [
      "a mismatch with evidence left out",
      { ...r1, evidence: undefined },
      "needs_review",
      ["MISSING_EVIDENCE"],
    ],
    [
      "malformed evidence (end before start), treated as missing",
      { ...r1, evidence: { ...r1.evidence, lines: [7, 3] } },
      "needs_review",
      ["MISSING_EVIDENCE"],
    ],
    [
      "a snippet that is not in the file",
      { ...r1, evidence: { ...r1.evidence, snippet: "codes.get(code.toUpperCase())" } },
      "needs_review",
      ["UNVERIFIED_EVIDENCE"],
    ],
    [
      "evidence in a file Claude was not shown",
      { ...r1, evidence: { ...r1.evidence, file: "src/cart/codes.js" } },
      "needs_review",
      ["UNVERIFIED_EVIDENCE"],
    ],
    [
      "lines slightly off (within tolerance)",
      { ...r1, evidence: { ...r1.evidence, lines: [3, 3] } },
      "confirmed",
      [],
    ],
    [
      "a confident match without evidence",
      { ...r1, type: "match", evidence: null },
      "confirmed",
      [],
    ],
    [
      "a not-implemented feature",
      { ...r1, type: "not_implemented", evidence: null, confidence: 0.8 },
      "confirmed",
      [],
    ],
  ])("reviews %s", (_name, answer, reviewStatus, reasons) => {
    const [first] = ok(reply(answer, r2));
    expect([first?.reviewStatus, first?.reviewReasons]).toStrictEqual([reviewStatus, reasons]);
  });

  it.each<[string, object, string | null]>([
    ["drops severity on a match", { ...r1, type: "match", severity: "high" }, null],
    [
      "keeps severity on not_implemented, so missing features can be prioritised like bugs",
      { ...r1, type: "not_implemented", evidence: null, severity: "high" },
      "high",
    ],
    ["keeps an unknown severity out", { ...r1, severity: "critical" }, null],
    ["leaves a missing severity empty", { ...r1, severity: undefined }, null],
    ["keeps a valid mismatch severity", { ...r1, severity: "low" }, "low"],
  ])("%s", (_name, answer, severity) => {
    expect(ok(reply(answer, r2))[0]?.severity).toBe(severity);
  });

  it("collapses whitespace in the explanation", () => {
    const [first] = ok(reply({ ...r1, explanation: "  Looks\n up   exactly\tas typed. " }, r2));
    expect(first?.explanation).toBe("Looks up exactly as typed.");
  });
});

describe("parseMatchingResponse — invalid replies become INVALID_AI_OUTPUT", () => {
  it.each<[string, string, RegExp]>([
    ["an empty reply", "", /no JSON object/],
    ["prose only", "I think the code is fine.", /no JSON object/],
    ["broken JSON", "{findings: [}", /not valid JSON/],
    ["findings that are not a list", '{"findings": "none"}', /findings/],
    ["a confidence given in percent", reply({ ...r1, confidence: 85 }, r2), /confidence/],
    ["an unknown type", reply({ ...r1, type: "partial" }, r2), /type/],
    ["an empty explanation", reply({ ...r1, explanation: "  " }, r2), /explanation/],
    ["a missing answer", reply(r1), /no finding for R2/],
    [
      "an unknown requirement id",
      reply(r1, r2, { ...r2, requirement: "R3" }),
      /unknown requirement R3/,
    ],
    ["two answers for one requirement", reply(r1, r2, r1), /more than one finding for R1/],
  ])("%s", (_name, raw, message) => {
    const result = parse(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_AI_OUTPUT");
      expect(result.error.message).toMatch(message);
    }
  });
});

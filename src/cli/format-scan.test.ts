import { describe, expect, it } from "vitest";
import { Confidence, type Finding } from "../core/domain/finding.ts";
import type { Requirement } from "../core/domain/requirement.ts";
import type { ScanResult } from "../services/scan-project.ts";
import { formatScan } from "./format-scan.ts";

const req = (tag: string, line: number): Requirement => ({
  tag,
  area: tag.split(" ")[0] ?? tag,
  text: `${tag} text`,
  source: { file: "shop.md", line },
});
const finding = (over: Partial<Finding> & { requirement: Requirement }): Finding => ({
  type: "match",
  severity: null,
  explanation: "Explained.",
  evidence: null,
  confidence: Confidence.parse(0.9),
  reviewStatus: "confirmed",
  reviewReasons: [],
  ...over,
});
const base: ScanResult = {
  prdFiles: ["shop.md", "checkout.md"],
  sourceFiles: 9,
  requirements: [],
  findings: [],
  notScanned: [],
  needsReview: [],
  extraction: { files: 0, dropped: 0 },
  warnings: [],
  stoppedBy: null,
  models: ["claude-sonnet-5"],
  usage: { aiCalls: 3, inputTokens: 7400, outputTokens: 1900 },
};

describe("formatScan", () => {
  it("lists what Claude found but is not sure of, as not compared", () => {
    const out = formatScan(
      {
        ...base,
        needsReview: [
          {
            area: "Checkout",
            text: "Guests can pay.",
            source: { file: "vision.md", line: 4 },
            quote: { lines: [4, 4], snippet: "Guests can pay by card." },
            confidence: Confidence.parse(0.5),
          },
        ],
      },
      null,
    );
    expect(out).toContain("Found by Claude, not compared, needs your review (1)");
    expect(out).toContain("  Checkout: Guests can pay.  (vision.md:4, confidence 0.50)");
  });

  it("leads with confirmed mismatches, then missing features, needs-review items and matches", () => {
    const scan: ScanResult = {
      ...base,
      requirements: [
        req("Cart 1.1", 7),
        req("Cart 1.2", 9),
        req("Shipping 2.1", 15),
        req("Account 3.1", 19),
      ],
      findings: [
        finding({ requirement: req("Cart 1.1", 7) }),
        finding({
          requirement: req("Cart 1.2", 9),
          type: "mismatch",
          severity: "medium",
          explanation: "Codes are compared exactly.",
          confidence: Confidence.parse(0.55),
          reviewStatus: "needs_review",
          reviewReasons: ["LOW_CONFIDENCE"],
        }),
        finding({
          requirement: req("Shipping 2.1", 15),
          type: "mismatch",
          severity: "high",
          explanation: "Exactly $50 still pays shipping.",
          evidence: { file: "src/checkout/shipping.js", lines: [6, 6], snippet: "subtotal > 50" },
        }),
        finding({
          requirement: req("Account 3.1", 19),
          type: "not_implemented",
          severity: "medium",
          explanation: "No order history page.",
        }),
      ],
    };
    expect(formatScan(scan, 0.034)).toBe(
      [
        "Scanned 4 requirements from 2 PRD files against 9 source files (claude-sonnet-5)",
        "",
        "Mismatches (1)",
        "  [high] Shipping 2.1  Exactly $50 still pays shipping.  (shop.md:15 -> src/checkout/shipping.js:6)",
        "",
        "Not implemented (1)",
        "  [medium] Account 3.1  No order history page.  (shop.md:19)",
        "",
        "Needs review (1)",
        "  [medium] mismatch Cart 1.2  Codes are compared exactly.  (shop.md:9)  - low confidence (0.55)",
        "",
        "Matches (1)",
        "  Cart 1.1  (shop.md:7)",
        "",
        "AI: 3 calls, 7,400 input + 1,900 output tokens, about $0.03",
      ].join("\n"),
    );
  });

  it.each<[Finding["reviewReasons"], string]>([
    [["MISSING_EVIDENCE"], "no code cited"],
    [["UNVERIFIED_EVIDENCE"], "cited code not found in the file"],
    [
      ["LOW_CONFIDENCE", "UNVERIFIED_EVIDENCE"],
      "low confidence (0.90), cited code not found in the file",
    ],
  ])("explains review reasons %j", (reasons, text) => {
    const scan: ScanResult = {
      ...base,
      findings: [
        finding({
          requirement: req("Cart 1.2", 9),
          reviewStatus: "needs_review",
          reviewReasons: reasons,
        }),
      ],
    };
    expect(formatScan(scan, null)).toContain(`- ${text}`);
  });

  it("reports what was not scanned, warnings, and an early stop with a hint for the terminal", () => {
    const scan: ScanResult = {
      ...base,
      notScanned: [req("Shipping 2.1", 15)],
      warnings: [{ code: "SOURCE_FILE_UNREADABLE", message: "src/x.js: denied" }],
      stoppedBy: { code: "AI_AUTH_FAILED", message: "The Anthropic API rejected the API key." },
    };
    const out = formatScan(scan, null);
    expect(out).toContain("Not scanned (1)\n  Shipping 2.1  (shop.md:15)");
    expect(out).toContain("Warnings\n  SOURCE_FILE_UNREADABLE: src/x.js: denied");
    expect(out).toContain(
      "Stopped early: AI_AUTH_FAILED - The Anthropic API rejected the API key. Check ANTHROPIC_API_KEY.",
    );
    expect(out).toContain("AI: 3 calls, 7,400 input + 1,900 output tokens");
    expect(out).not.toContain("about $");
  });

  it("says plainly when there was nothing to scan", () => {
    const scan: ScanResult = {
      ...base,
      prdFiles: [],
      models: [],
      usage: { aiCalls: 0, inputTokens: 0, outputTokens: 0 },
      warnings: [{ code: "NO_PRD_FILES", message: "No PRD files in prds" }],
    };
    expect(formatScan(scan, null)).toBe(
      [
        "Scanned 0 requirements from 0 PRD files against 9 source files",
        "",
        "Warnings",
        "  NO_PRD_FILES: No PRD files in prds",
        "",
        "AI: 0 calls",
      ].join("\n"),
    );
  });
});

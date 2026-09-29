import { describe, expect, it } from "vitest";
import { Confidence, type Finding } from "../domain/finding.ts";
import type { Requirement } from "../domain/requirement.ts";
import {
  checkGeneratedTest,
  GENERATED_TEST_DIR,
  generatedTestFileNames,
  shouldGenerateTest,
} from "./generated-test.ts";

const req = (tag: string, area: string, text: string, line = 1): Requirement => ({
  tag,
  area,
  text,
  source: { file: "shop.md", line },
});
const finding = (over: Partial<Finding>): Finding => ({
  requirement: req("Cart 1.2", "Cart", "Codes."),
  type: "match",
  severity: null,
  explanation: "x",
  evidence: null,
  confidence: Confidence.parse(0.9),
  reviewStatus: "confirmed",
  reviewReasons: [],
  ...over,
});

describe("GENERATED_TEST_DIR", () => {
  it("is tests/autoai (ADR 0004)", () => {
    expect(GENERATED_TEST_DIR).toBe("tests/autoai");
  });
});

describe("shouldGenerateTest", () => {
  it.each<[Partial<Finding>, boolean]>([
    [{ type: "match" }, true],
    [{ type: "mismatch", severity: "high" }, true],
    [{ type: "not_implemented", severity: "medium" }, false],
    [{ type: "match", reviewStatus: "needs_review", reviewReasons: ["LOW_CONFIDENCE"] }, false],
    [
      { type: "mismatch", reviewStatus: "needs_review", reviewReasons: ["MISSING_EVIDENCE"] },
      false,
    ],
  ])("%j -> %s", (over, expected) => {
    expect(shouldGenerateTest(finding(over))).toBe(expected);
  });
});

describe("generatedTestFileNames", () => {
  it.each<[Requirement, string]>([
    [
      req("Cart 1.2", "Cart", 'Discount codes are case-insensitive: "SAVE10" works.'),
      "cart-1-2-discount-codes-are-case-insensitive-save10.spec.ts",
    ],
    [
      req("Checkout", "Checkout", "Guests can pay by card."),
      "checkout-guests-can-pay-by-card.spec.ts",
    ],
    [req("Discounts", "Cart", "Codes expire."), "cart-discounts-codes-expire.spec.ts"],
    [req("Sign-Up 1.2", "Sign-Up", "Email is required."), "sign-up-1-2-email-is-required.spec.ts"],
    [req("Café 2.1", "Café", "Menu lists déjà vu."), "cafe-2-1-menu-lists-deja-vu.spec.ts"],
    [req("עגלה 1.2", "עגלה", "קוד הנחה", 9), "1-2.spec.ts"],
    [req("עגלה", "עגלה", "קוד הנחה", 9), "requirement-l9.spec.ts"],
  ])("%j -> %s", (requirement, name) => {
    expect(generatedTestFileNames([requirement])).toStrictEqual([name]);
  });

  it("keeps names short, cutting at a word boundary", () => {
    const [name] = generatedTestFileNames([
      req(
        "Checkout Flow 3.1",
        "Checkout Flow",
        "Supercalifragilistic expialidocious antidisestablishmentarianism words keep going",
      ),
    ]);
    expect(name?.replace(".spec.ts", "").length).toBeLessThanOrEqual(60);
    expect(name).toMatch(/^[a-z0-9][a-z0-9-]*[a-z0-9]\.spec\.ts$/);
  });

  it("makes names unique within one run by adding the PRD line", () => {
    expect(
      generatedTestFileNames([
        req("Checkout", "Checkout", "Guests can pay.", 3),
        req("Checkout", "Checkout", "Guests can pay.", 12),
      ]),
    ).toStrictEqual(["checkout-guests-can-pay.spec.ts", "checkout-guests-can-pay-l12.spec.ts"]);
  });
});

describe("checkGeneratedTest", () => {
  const good = [
    "// AutoAI requirement: Cart 1.2",
    'import { expect, test } from "@playwright/test";',
    "",
    'test("A lower-case discount code applies the discount", async ({ page }) => {',
    '  await page.goto("/");',
    '  await page.getByLabel("Discount code").fill("save10");',
    '  await page.getByRole("button", { name: "Apply" }).click();',
    '  await expect(page.getByRole("status")).toHaveText("Discount SAVE10 applied");',
    "});",
  ].join("\n");
  const edit = (from: string, to: string) => good.replace(from, to);

  it("accepts a test that follows every rule", () => {
    expect(checkGeneratedTest(good, "Cart 1.2")).toStrictEqual([]);
  });

  it.each<[string, string, RegExp]>([
    [
      "a missing requirement comment",
      edit("// AutoAI requirement: Cart 1.2\n", ""),
      /First line must be "\/\/ AutoAI requirement: Cart 1\.2"/,
    ],
    ["the wrong requirement tag", edit("Cart 1.2\n", "Cart 9.9\n"), /First line must be/],
    [
      "no assertion",
      edit('  await expect(page.getByRole("status")).toHaveText("Discount SAVE10 applied");\n', ""),
      /no expect\(/i,
    ],
    [
      "a fixed wait",
      edit('  await page.goto("/");', '  await page.goto("/");\n  await page.waitForTimeout(500);'),
      /waitForTimeout/,
    ],
    ["test.only", edit("test(", "test.only("), /\.only/],
    ["test.skip", edit("test(", "test.skip("), /\.skip or \.fixme/],
    ["test.fixme", edit("test(", "test.fixme("), /\.skip or \.fixme/],
    [
      "an absolute URL",
      edit('page.goto("/")', 'page.goto("http://localhost:4173/")'),
      /absolute URL/,
    ],
    [
      "an import from the app",
      edit(
        'import { expect, test } from "@playwright/test";',
        'import { expect, test } from "@playwright/test";\nimport { findDiscount } from "../../src/cart/discounts.js";',
      ),
      /Imports "..\/..\/src\/cart\/discounts.js"/,
    ],
    ["a require call", edit("", "") + '\nconst fs = require("node:fs");', /Imports "node:fs"/],
    [
      "no Playwright import",
      edit('import { expect, test } from "@playwright/test";\n', ""),
      /Does not import from "@playwright\/test"/,
    ],
  ])("rejects %s", (_name, code, problem) => {
    const problems = checkGeneratedTest(code, "Cart 1.2");
    expect(problems.join("\n")).toMatch(problem);
  });
});

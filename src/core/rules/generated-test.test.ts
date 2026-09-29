import { describe, expect, it } from "vitest";
import { Confidence, type Finding } from "../domain/finding.ts";
import type { Requirement } from "../domain/requirement.ts";
import type { PackageDependencies } from "../parsing/package-json.ts";
import {
  checkGeneratedTest,
  existingTestPath,
  GENERATED_TEST_DIR,
  generatedTestFileNames,
  generatedTestFileOf,
  isGeneratedTestFileName,
  PLAYWRIGHT_NOTICE,
  playwrightNotice,
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

describe("isGeneratedTestFileName", () => {
  it.each<[string, boolean]>([
    ["cart-1-2-codes.spec.ts", true],
    ["1-2.spec.ts", true],
    ["Cart.spec.ts", false],
    ["-cart.spec.ts", false],
    [".hidden.spec.ts", false],
    ["cart.test.ts", false],
    ["cart.spec.js", false],
    ["../cart.spec.ts", false],
    ["sub/cart.spec.ts", false],
    ["/abs/cart.spec.ts", false],
    ["cart .spec.ts", false],
    ["", false],
  ])("%j -> %s (a plain kebab-case *.spec.ts name, nothing else)", (name, expected) => {
    expect(isGeneratedTestFileName(name)).toBe(expected);
  });
});

describe("generatedTestFileOf", () => {
  it.each<[string, string | null]>([
    ["tests/autoai/cart-codes.spec.ts", "cart-codes.spec.ts"],
    ["tests/autoai/sub/cart-codes.spec.ts", null],
    ["tests/cart-codes.spec.ts", null],
    ["tests/autoai/../cart-codes.spec.ts", null],
    ["tests/autoai/../../etc/x.spec.ts", null],
    ["./tests/autoai/cart-codes.spec.ts", null],
    ["/repo/tests/autoai/cart-codes.spec.ts", null],
    ["tests\\autoai\\cart-codes.spec.ts", null],
    ["tests/autoai/", null],
    ["tests/autoai/Cart.spec.ts", null],
  ])("%j -> %j (only a spec directly inside tests/autoai)", (path, name) => {
    expect(generatedTestFileOf(path)).toBe(name);
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
      "a dynamic import with a template literal",
      `${good}\nawait import(\`node:fs\`);`,
      /Imports "node:fs"/,
    ],
    [
      "a type-only import from the app",
      `${good}\nimport type { Cart } from "../../src/cart.js";`,
      /Imports "..\/..\/src\/cart.js"/,
    ],
    ["a re-export", `${good}\nexport { helper } from "./helpers";`, /Imports ".\/helpers"/],
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

describe("existingTestPath", () => {
  const existing = [
    {
      path: "tests/autoai/cart-1-2-old-name.spec.ts",
      firstLine: "// AutoAI requirement: Cart 1.2",
    },
    {
      path: "tests/autoai/handwritten.spec.ts",
      firstLine: 'import { test } from "@playwright/test";',
    },
    { path: "tests/autoai/checkout-guests.spec.ts", firstLine: "// AutoAI requirement: Checkout" },
  ];

  it.each<[string, string, string | null]>([
    ["Cart 1.2", "cart-1-2-new-name.spec.ts", "tests/autoai/cart-1-2-old-name.spec.ts"],
    ["Cart 1.3", "handwritten.spec.ts", "tests/autoai/handwritten.spec.ts"],
    ["Checkout", "checkout-pay.spec.ts", "tests/autoai/checkout-guests.spec.ts"],
    ["Cart 1.3", "cart-1-3.spec.ts", null],
    ["Cart 1.20", "cart-1-20.spec.ts", null],
  ])("tag %s / file %s -> %s", (tag, fileName, path) => {
    expect(existingTestPath(tag, fileName, existing)).toBe(path);
  });

  it("ignores trailing spaces in the header", () => {
    expect(
      existingTestPath("Cart 1.2", "x.spec.ts", [
        { path: "tests/autoai/a.spec.ts", firstLine: "  // AutoAI requirement: Cart 1.2  " },
      ]),
    ).toBe("tests/autoai/a.spec.ts");
  });
});

describe("playwrightNotice", () => {
  it.each<[string, PackageDependencies | null, string | null]>([
    ["a dev dependency", { names: ["@playwright/test", "vite"] }, null],
    ["a dependency", { names: ["@playwright/test"] }, null],
    ["no Playwright", { names: ["react"] }, PLAYWRIGHT_NOTICE],
    ["no package.json, or one that cannot be read", null, PLAYWRIGHT_NOTICE],
  ])("%s -> %s", (_name, pkg, notice) => {
    expect(playwrightNotice(pkg)).toBe(notice);
  });
});

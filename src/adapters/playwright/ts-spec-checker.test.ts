import { describe, expect, it } from "vitest";
import { createTsSpecChecker } from "./ts-spec-checker.ts";

const checker = createTsSpecChecker();
const good = [
  "// AutoAI requirement: Cart 1.2",
  'import { expect, test } from "@playwright/test";',
  "",
  'test("A lower-case discount code applies the discount", async ({ page }) => {',
  '  await page.goto("/");',
  '  await page.getByLabel("Discount code").fill("save10");',
  '  await page.getByRole("button", { name: "Apply" }).click();',
  '  await expect(page.getByRole("status")).toHaveText("Discount SAVE10 applied");',
  "  const title = await page.evaluate(() => document.title);",
  '  expect(title).toBe("Sample Shop");',
  "});",
].join("\n");

describe("TsSpecChecker", { timeout: 30_000 }, () => {
  it("accepts a valid spec using Playwright's own types (and DOM types inside evaluate)", async () => {
    expect(await checker.check("cart.spec.ts", good)).toStrictEqual({ errors: [] });
  });

  it.each([
    [
      "a wrong argument type",
      good.replace('page.goto("/")', "page.goto(42)"),
      /^5:\d+ .*number.*string/,
    ],
    ["an unknown method", good.replace("getByLabel", "getByLabelz"), /^6:\d+ .*getByLabelz/],
    [
      "a missing import",
      good.replace('import { expect, test } from "@playwright/test";', ""),
      /Cannot find name 'test'/,
    ],
    [
      "an import from the app",
      `${good}\nimport { x } from "./helpers";`,
      /Cannot find module '.\/helpers'/,
    ],
    ["a syntax error", good.replace("async ({ page }) => {", "async ({ page }) => {{"), /\d+:\d+ /],
  ])("reports %s with line:column", async (_name, text, message) => {
    const { errors } = await checker.check("cart.spec.ts", text);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join("\n")).toMatch(message);
  });

  it("checks each spec on its own, independent of earlier ones", async () => {
    await checker.check("a.spec.ts", "const broken: number = 'x';");
    expect(await checker.check("b.spec.ts", good)).toStrictEqual({ errors: [] });
  });
});

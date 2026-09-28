import { describe, expect, it } from "vitest";
import {
  indexFiles,
  MAX_SOURCE_CHARS,
  rankRelevantFiles,
  RELEVANT_FILE_LIMIT,
} from "./relevance.ts";

const file = (path: string, text = "") => ({ path, text });
const rank = (
  area: string,
  text: string,
  files: { path: string; text: string }[],
  limit?: number,
) => rankRelevantFiles({ area, text }, indexFiles(files), limit);

describe("rankRelevantFiles", () => {
  it("scores filename (3) over folder (2) over content (1), doubles area words, and explains the match", () => {
    const result = rank("Cart", "Discount codes are case-insensitive.", [
      file("src/cart/discounts.js", "export const codes = new Map();"),
      file("src/app.js", "applyDiscount(cart);"),
      file("src/money.js", "export function formatMoney() {}"),
      file("README.md", "cart discount codes"),
    ]);
    expect(result).toStrictEqual([
      // cart: folder 2 x area 2 = 4; discount: filename 3; code: content 1
      { path: "src/cart/discounts.js", score: 8, matched: ["cart", "code", "discount"] },
      // cart: content 1 x area 2 = 2; discount: content 1
      { path: "src/app.js", score: 3, matched: ["cart", "discount"] },
    ]);
  });

  it.each([
    ["camelCase file names", "src/checkout/placeOrder.ts"],
    ["kebab-case file names", "src/checkout/place-order.ts"],
    ["snake_case file names", "src/checkout/place_order.py.ts"],
  ])("splits %s into words", (_name, path) => {
    const [top] = rank("Checkout", "Place order stays disabled.", [file(path)]);
    expect(top?.matched).toStrictEqual(["checkout", "order", "place"]);
  });

  it.each([
    ["plural -s", "Items are listed", "src/item.ts"],
    ["plural -es", "Addresses are saved", "src/address.ts"],
    ["plural -ies", "Categories are listed", "src/category.ts"],
    ["singular requirement, plural file", "The invoice is emailed", "src/invoices.ts"],
  ])("folds %s", (_name, text, path) => {
    expect(rank("Misc", text, [file(path)]).map((r) => r.path)).toStrictEqual([path]);
  });

  it("matches words inside identifiers in file content", () => {
    const result = rank("Misc", "The empty message is hidden.", [
      file("src/app.js", '$("cart-empty").hidden = !isEmpty(cart);'),
    ]);
    expect(result[0]?.matched).toStrictEqual(["empty", "hidden"]);
  });

  it("ignores stop-words, short words and numbers", () => {
    expect(
      rank("A", "It is 10% of the fee.", [file("src/of/the/is.ts", "it is a 10")]),
    ).toStrictEqual([]);
    expect(rank("A", "It is 10% of the fee.", [file("src/fee.ts")])[0]?.matched).toStrictEqual([
      "fee",
    ]);
  });

  it("drops files that match nothing and skips non-source files", () => {
    expect(
      rank("Account", "Order history lists past orders.", [
        file("src/cart/cart.js", "export function addItem() {}"),
        file("tests/autoai/order-history.spec.ts", "order history"),
        file("docs/order-history.md", "order history"),
      ]),
    ).toStrictEqual([]);
  });

  it("keeps the best files up to the limit, ties broken by path", () => {
    const files = ["src/c/cart.ts", "src/a/cart.ts", "src/b/cart.ts", "src/cart/deep/x.ts"].map(
      (p) => file(p),
    );
    expect(rank("Cart", "Cart works.", files, 2).map((r) => r.path)).toStrictEqual([
      "src/a/cart.ts",
      "src/b/cart.ts",
    ]);
  });

  it("uses RELEVANT_FILE_LIMIT by default", () => {
    const files = Array.from({ length: RELEVANT_FILE_LIMIT + 3 }, (_, i) =>
      file(`src/cart${String(i)}/cart.ts`),
    );
    expect(rank("Cart", "Cart works.", files)).toHaveLength(RELEVANT_FILE_LIMIT);
  });

  it("ranks a content-only match below any name or folder match", () => {
    const result = rank("Misc", "Invoices are emailed.", [
      file("src/mailer.ts", "sendInvoice(); emailed = true;"),
      file("src/billing/invoice.ts"),
    ]);
    expect(result.map((r) => [r.path, r.score])).toStrictEqual([
      ["src/billing/invoice.ts", 3],
      ["src/mailer.ts", 2],
    ]);
  });

  it("matches words in any language, not only English", () => {
    const result = rank("עגלה", "קוד הנחה לא תלוי באותיות.", [
      file("src/discount.ts", "// הנחה לפי קוד"),
      file("src/other.ts", "const x = 1;"),
    ]);
    expect(result.map((r) => r.matched)).toStrictEqual([["הנחה", "קוד"]]);
  });

  it("never indexes files over MAX_SOURCE_CHARS, such as generated bundles", () => {
    const huge = `cart ${"x".repeat(MAX_SOURCE_CHARS)}`;
    expect(rank("Cart", "Cart works.", [file("src/cart.js", huge)])).toStrictEqual([]);
    expect(rank("Cart", "Cart works.", [file("src/cart.js", "cart")])).toHaveLength(1);
  });

  it("returns nothing when the requirement has no usable words", () => {
    expect(rank("It", "It is the one.", [file("src/one.ts", "it is the one")])).toStrictEqual([]);
  });
});

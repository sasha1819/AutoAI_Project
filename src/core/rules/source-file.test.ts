import { describe, expect, it } from "vitest";
import { isSourceFile } from "./source-file.ts";

describe("isSourceFile", () => {
  it.each([
    ["src/cart/discounts.ts", true],
    ["src/App.tsx", true],
    ["lib/format.js", true],
    ["web/Widget.jsx", true],
    ["server.mjs", true],
    ["config/legacy.cjs", true],
    ["components/Cart.vue", true],
    ["routes/+page.svelte", true],
    ["index.html", true],
    ["src/styles.css", false],
    ["README.md", false],
    ["package.json", false],
    ["logo.png", false],
    ["src/types.d.ts", false],
    ["public/vendor.min.js", false],
    ["src/cart.test.ts", false],
    ["src/cart.spec.tsx", false],
    ["tests/autoai/cart-discount.spec.ts", false],
    ["test/helpers.js", false],
    ["src/__tests__/cart.js", false],
    ["e2e/checkout.ts", false],
    ["node_modules/react/index.js", false],
    ["packages/web/node_modules/x/y.js", false],
    ["dist/app.js", false],
    ["build/app.js", false],
    ["out/app.js", false],
    ["coverage/lcov-report/prettify.js", false],
    ["vendor/jquery.js", false],
    [".next/server/app.js", false],
    ["src/.cache/x.js", false],
  ])("%s -> %s", (path, expected) => {
    expect(isSourceFile(path)).toBe(expected);
  });
});

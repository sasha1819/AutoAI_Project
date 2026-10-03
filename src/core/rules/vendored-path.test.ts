import { describe, expect, it } from "vitest";
import { isVendoredPath } from "./vendored-path.ts";

describe("isVendoredPath", () => {
  it.each([
    ["node_modules/react/README.md", true],
    ["packages/app/node_modules/x/index.js", true],
    ["dist/main.js", true],
    ["build/notes.md", true],
    ["out/index.html", true],
    ["coverage/index.html", true],
    ["vendor/lib.js", true],
    ["src/build-steps.md", false],
    ["docs/prds/cart.md", false],
    ["distribution/plan.md", false],
    ["tests/plan.md", false],
  ])("%s -> %s", (path, expected) => {
    expect(isVendoredPath(path)).toBe(expected);
  });
});

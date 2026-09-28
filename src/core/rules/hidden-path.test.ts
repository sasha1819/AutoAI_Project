import { describe, expect, it } from "vitest";
import { isHiddenPath } from "./hidden-path.ts";

describe("isHiddenPath", () => {
  it.each([
    [".env", true],
    [".git/config", true],
    ["src/.cache/x.js", true],
    ["docs/.drafts/cart.md", true],
    ["src/cart.js", false],
    ["docs/cart.md", false],
    ["src/app.config.js", false],
  ])("%s -> %s", (path, expected) => {
    expect(isHiddenPath(path)).toBe(expected);
  });
});

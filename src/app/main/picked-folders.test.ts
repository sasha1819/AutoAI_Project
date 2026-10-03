import { describe, expect, it } from "vitest";
import { createPickedFolders } from "./picked-folders.ts";

describe("createPickedFolders", () => {
  it("allows only a folder the user picked, for the purpose it was picked for", () => {
    const picked = createPickedFolders();
    picked.remember("repo", "/work/shop");
    picked.remember("prds", "/work/shop/docs");

    expect(picked.allows("repo", "/work/shop")).toBe(true);
    expect(picked.allows("prds", "/work/shop/docs")).toBe(true);
    expect(picked.allows("prds", "/work/shop")).toBe(false);
    expect(picked.allows("repo", "/work/shop/docs")).toBe(false);
  });

  it.each(["/", "/etc", "/work", "/work/shop/../other", "/work/shop/", "/work/shop/src", ""])(
    "refuses %j, which was never picked",
    (path) => {
      const picked = createPickedFolders();
      picked.remember("repo", "/work/shop");
      expect(picked.allows("repo", path)).toBe(false);
    },
  );

  it("refuses everything before any pick", () => {
    expect(createPickedFolders().allows("repo", "/work/shop")).toBe(false);
  });

  it.each([
    [{ repoRoot: "/work/shop", prdFolder: null }, true],
    [{ repoRoot: "/work/shop", prdFolder: "/work/shop/docs" }, true],
    [{ repoRoot: "/work/shop", prdFolder: "/etc" }, false],
    [{ repoRoot: "/work/shop/docs", prdFolder: null }, false],
    [{ repoRoot: "/home", prdFolder: "/work/shop/docs" }, false],
  ])("a scan of %o is allowed: %s", (input, expected) => {
    const picked = createPickedFolders();
    picked.remember("repo", "/work/shop");
    picked.remember("prds", "/work/shop/docs");
    expect(picked.allowsScan(input)).toBe(expected);
  });
});

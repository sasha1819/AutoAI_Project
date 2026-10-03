import { describe, expect, it } from "vitest";
import { isPrdFile } from "./prd-file.ts";

describe("isPrdFile", () => {
  it.each([
    ["cart.md", true],
    ["Cart.MD", true],
    ["notes.markdown", true],
    ["spec.txt", true],
    ["checkout/payments/flow.md", true],
    ["image.png", false],
    ["spec.docx", false],
    ["notes.md.bak", false],
    ["md", false],
    ["README", false],
    [".hidden.md", false],
    [".git/COMMIT.md", false],
    ["drafts/.old/cart.md", false],
    ["node_modules/react/README.md", false],
    ["web/dist/CHANGELOG.md", false],
  ])("%s -> %s", (path, expected) => {
    expect(isPrdFile(path)).toBe(expected);
  });
});

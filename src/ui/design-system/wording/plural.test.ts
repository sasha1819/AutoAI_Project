import { describe, expect, it } from "vitest";
import { plural } from "./plural.ts";

describe("plural", () => {
  it.each([
    [0, "0 files"],
    [1, "1 file"],
    [2, "2 files"],
  ])("%i -> %s", (n, expected) => {
    expect(plural(n, "file")).toBe(expected);
  });
});

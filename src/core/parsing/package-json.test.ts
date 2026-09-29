import { describe, expect, it } from "vitest";
import { parsePackageDependencies } from "./package-json.ts";

describe("parsePackageDependencies", () => {
  it("lists dependency and devDependency names", () => {
    const text = JSON.stringify({
      name: "shop",
      dependencies: { react: "19" },
      devDependencies: { "@playwright/test": "^1.63.0" },
    });
    expect(parsePackageDependencies(text)).toStrictEqual({ names: ["react", "@playwright/test"] });
  });

  it("treats a package.json without dependencies as having none", () => {
    expect(parsePackageDependencies('{"name": "x"}')).toStrictEqual({ names: [] });
  });

  it.each([
    ["not JSON", "{not json"],
    ["not an object", "[]"],
    ["dependencies that are not an object", '{"dependencies": ["react"]}'],
  ])("returns null for %s", (_name, text) => {
    expect(parsePackageDependencies(text)).toBeNull();
  });
});

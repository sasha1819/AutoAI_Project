import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseCliArgs, timeStamp } from "./cli-args.ts";

const options = { repo: { type: "string" }, json: { type: "boolean", default: false } } as const;
const Schema = z.object({ repo: z.string().min(1), json: z.boolean() });

describe("parseCliArgs", () => {
  it("returns the validated options", () => {
    expect(parseCliArgs(["--repo", "x", "--json"], options, Schema)).toStrictEqual({
      repo: "x",
      json: true,
    });
  });

  it.each([
    ["an unknown option", ["--repo", "x", "--nope"]],
    ["a positional argument", ["x"]],
    ["a missing value", ["--repo"]],
    ["a missing required option", []],
    ["an empty value", ["--repo", ""]],
  ])("returns null for %s (a usage error)", (_name, argv) => {
    expect(parseCliArgs(argv, options, Schema)).toBeNull();
  });
});

describe("timeStamp", () => {
  it("is file-name safe and sorts by time", () => {
    expect(timeStamp(new Date("2026-09-30T19:26:09.396Z"))).toBe("2026-09-30T19-26-09-396Z");
  });
});

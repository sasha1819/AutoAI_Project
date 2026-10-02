import { describe, expect, it } from "vitest";
import { ApiKey } from "./api-key.ts";

describe("ApiKey", () => {
  it("accepts one token, trimmed", () => {
    expect(ApiKey.parse("  sk-example-123  ")).toBe("sk-example-123");
  });
  it.each([
    ["empty", ""],
    ["blank", "   "],
    ["with a space inside", "sk-ex ample"],
    ["absurdly long", "k".repeat(513)],
  ])("refuses a key that is %s", (_name, text) => {
    expect(ApiKey.safeParse(text).success).toBe(false);
  });
});

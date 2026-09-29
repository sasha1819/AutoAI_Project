import { describe, expect, it } from "vitest";
import { parseGeneratedTest } from "./generated-test.ts";

describe("parseGeneratedTest", () => {
  it("reads the title and the code, keeping the code exactly as written", () => {
    const code = '// AutoAI requirement: Cart 1.2\nimport { test } from "@playwright/test";\n';
    expect(
      parseGeneratedTest(JSON.stringify({ title: "  Codes  ignore case ", code })),
    ).toStrictEqual({
      ok: true,
      value: { title: "Codes ignore case", code },
    });
  });

  it.each([
    ["not JSON", "here is your test", /no JSON object/],
    ["a missing code field", JSON.stringify({ title: "t" }), /code/],
    ["an empty title", JSON.stringify({ title: " ", code: "x" }), /title/],
    ["blank code", JSON.stringify({ title: "t", code: "  \n" }), /code/],
  ])("rejects %s as INVALID_AI_OUTPUT", (_name, raw, message) => {
    const result = parseGeneratedTest(raw);
    expect(result.ok ? null : result.error.code).toBe("INVALID_AI_OUTPUT");
    expect(result.ok ? "" : result.error.message).toMatch(message);
  });
});

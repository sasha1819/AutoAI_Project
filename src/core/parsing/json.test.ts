import { describe, expect, it } from "vitest";
import { extractJson } from "./json.ts";

describe("extractJson", () => {
  it.each<[string, string, unknown]>([
    ["a bare object", '{"a": 1}', { a: 1 }],
    ["an object inside prose", 'Here it is: {"a": 1} Done.', { a: 1 }],
    [
      "a fenced object, ignoring braces in the prose",
      'I used {braces}.\n```json\n{"a": 1}\n```\nSee {x}.',
      { a: 1 },
    ],
    ["a fence without a language", '```\n{"a": [1, 2]}\n```', { a: [1, 2] }],
  ])("reads %s", (_name, raw, value) => {
    expect(extractJson(raw)).toStrictEqual({ ok: true, value });
  });

  it.each([
    ["", /no JSON object/],
    ["just words", /no JSON object/],
    ["{not json}", /not valid JSON/],
  ])("rejects %j", (raw, message) => {
    const result = extractJson(raw);
    expect(result.ok ? null : result.error.code).toBe("INVALID_AI_OUTPUT");
    expect(result.ok ? "" : result.error.message).toMatch(message);
  });
});

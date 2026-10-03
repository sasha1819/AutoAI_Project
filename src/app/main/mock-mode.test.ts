import { describe, expect, it } from "vitest";
import { isMockAiMode } from "./mock-mode.ts";

describe("isMockAiMode", () => {
  it.each([
    [{ AUTOAI_MOCK_AI: "1" }, false, true],
    [{ AUTOAI_MOCK_AI: "1" }, true, false],
    [{}, false, false],
    [{ AUTOAI_MOCK_AI: "true" }, false, false],
    [{ AUTOAI_MOCK_AI: "0" }, false, false],
  ])(
    "env %o, packaged %s -> %s (a packaged app ignores the variable)",
    (env, packaged, expected) => {
      expect(isMockAiMode({ env, packaged })).toBe(expected);
    },
  );
});

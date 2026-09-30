import { describe, expect, it } from "vitest";
import { err, ok } from "../core/domain/result.ts";
import { invalid } from "../core/parsing/json.ts";
import { INVALID_AI_OUTPUT_ATTEMPTS } from "../core/rules/batching.ts";
import { askAi, askUntilValid, newAiTally, usageOf } from "./ask-ai.ts";
import { scriptedAiProvider } from "./testing/scripted-ai-provider.ts";

const request = { system: "s", user: "u" };
const parseNumber = (text: string) => {
  const n = Number(text);
  return Number.isNaN(n) ? invalid(`not a number: ${text}`) : ok(n);
};

describe("askAi", () => {
  it("counts a call that answered, and not one that failed", async () => {
    const tally = newAiTally();
    await askAi(scriptedAiProvider("1"), request, tally);
    await askAi(scriptedAiProvider({ code: "AI_UNAVAILABLE", message: "down" }), request, tally);
    expect(tally).toStrictEqual({
      aiCalls: 1,
      inputTokens: 100,
      outputTokens: 20,
      models: new Set(["claude-sonnet-5"]),
    });
    expect(usageOf(tally)).toStrictEqual({ aiCalls: 1, inputTokens: 100, outputTokens: 20 });
  });
});

describe("askUntilValid", () => {
  it("returns the first answer that parses, with its model", async () => {
    const tally = newAiTally();
    const ai = scriptedAiProvider("nope", "42");
    expect(await askUntilValid(ai, request, parseNumber, tally)).toStrictEqual(
      ok({ value: 42, model: "claude-sonnet-5" }),
    );
    expect(ai.requests).toStrictEqual([request, request]);
    expect(tally.aiCalls).toBe(2);
  });

  it(`gives up after ${String(INVALID_AI_OUTPUT_ATTEMPTS)} invalid answers with the last problem`, async () => {
    const ai = scriptedAiProvider("a", "b", "c");
    expect(await askUntilValid(ai, request, parseNumber, newAiTally())).toStrictEqual(
      invalid("not a number: b"),
    );
    expect(ai.requests).toHaveLength(INVALID_AI_OUTPUT_ATTEMPTS);
  });

  it("stops at once on an AI error", async () => {
    const ai = scriptedAiProvider({ code: "AI_RATE_LIMITED", message: "slow down" }, "1");
    expect(await askUntilValid(ai, request, parseNumber, newAiTally())).toStrictEqual(
      err({ code: "AI_RATE_LIMITED", message: "slow down" }),
    );
    expect(ai.requests).toHaveLength(1);
  });
});

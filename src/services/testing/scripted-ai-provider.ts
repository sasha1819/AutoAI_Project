import { err, ok, type Result } from "../../core/domain/result.ts";
import type { AiCompletion, AiError, AiProvider, AiRequest } from "../../core/ports/ai-provider.ts";

export type ScriptedAiProvider = AiProvider & {
  readonly requests: readonly AiRequest[];
  /** How many times verifyAccess was asked (it never spends a scripted answer). */
  readonly accessChecks: () => number;
};

/**
 * Test double for AiProvider: answers calls in order from a script. A string is a successful answer with that
 * text (model claude-sonnet-5, 100 input / 20 output tokens); an AiError is returned as a failure.
 */
export function scriptedAiProvider(...script: (string | AiError)[]): ScriptedAiProvider {
  const requests: AiRequest[] = [];
  let checks = 0;
  // A key check always passes here and spends no scripted answer; scriptedAccess gives one that fails.
  return {
    requests,
    accessChecks: () => checks,
    verifyAccess: () => {
      checks += 1;
      return Promise.resolve(ok(undefined));
    },
    complete: (request) => {
      requests.push(request);
      const next = script.shift();
      if (next === undefined)
        throw new Error(`no scripted answer for AI call ${String(requests.length)}`);
      const result: Result<AiCompletion, AiError> =
        typeof next === "string"
          ? ok({
              text: next,
              model: "claude-sonnet-5",
              usage: { inputTokens: 100, outputTokens: 20 },
            })
          : err(next);
      return Promise.resolve(result);
    },
  };
}

/** Test double for an AiProvider whose key check answers `result`; it is never asked to complete anything. */
export function scriptedAccess(result: Result<undefined, AiError>): AiProvider {
  return {
    complete: () => {
      throw new Error("this provider is only for key checks");
    },
    verifyAccess: () => Promise.resolve(result),
  };
}

import { err, ok, type Result } from "../../core/domain/result.ts";
import type { AiCompletion, AiError, AiProvider, AiRequest } from "../../core/ports/ai-provider.ts";

export type ScriptedAiProvider = AiProvider & { readonly requests: readonly AiRequest[] };

/**
 * Test double for AiProvider: answers calls in order from a script. A string is a successful answer with that
 * text (model claude-sonnet-5, 100 input / 20 output tokens); an AiError is returned as a failure.
 */
export function scriptedAiProvider(...script: (string | AiError)[]): ScriptedAiProvider {
  const requests: AiRequest[] = [];
  return {
    requests,
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

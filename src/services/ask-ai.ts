import { err, ok, type Result } from "../core/domain/result.ts";
import type { InvalidAiOutput } from "../core/parsing/json.ts";
import type {
  AiCompletion,
  AiError,
  AiProvider,
  AiRequest,
  AiUsage,
} from "../core/ports/ai-provider.ts";
import { INVALID_AI_OUTPUT_ATTEMPTS } from "../core/rules/batching.ts";

/** What a use case spent on the AI so far: calls that answered, their tokens, and the models that answered. */
export type AiTally = {
  aiCalls: number;
  inputTokens: number;
  outputTokens: number;
  readonly models: Set<string>;
};

export function newAiTally(): AiTally {
  return { aiCalls: 0, inputTokens: 0, outputTokens: 0, models: new Set() };
}

/** The usage a use case reports: calls that answered and their tokens. */
export function usageOf(tally: AiTally): { readonly aiCalls: number } & AiUsage {
  return {
    aiCalls: tally.aiCalls,
    inputTokens: tally.inputTokens,
    outputTokens: tally.outputTokens,
  };
}

/** One AI call, counted in the tally when it answered. */
export async function askAi(
  ai: AiProvider,
  request: AiRequest,
  tally: AiTally,
): Promise<Result<AiCompletion, AiError>> {
  const reply = await ai.complete(request);
  if (reply.ok) {
    tally.aiCalls += 1;
    tally.inputTokens += reply.value.usage.inputTokens;
    tally.outputTokens += reply.value.usage.outputTokens;
    tally.models.add(reply.value.model);
  }
  return reply;
}

/**
 * Asks with the same prompt until the answer parses, at most INVALID_AI_OUTPUT_ATTEMPTS times (the shared
 * invalid-output policy). An AI error ends it at once; the caller decides what that error means for its use case.
 */
export async function askUntilValid<T>(
  ai: AiProvider,
  request: AiRequest,
  parse: (text: string) => Result<T, InvalidAiOutput>,
  tally: AiTally,
): Promise<Result<{ readonly value: T; readonly model: string }, AiError | InvalidAiOutput>> {
  let problem: InvalidAiOutput = { code: "INVALID_AI_OUTPUT", message: "no answer" };
  for (let attempt = 1; attempt <= INVALID_AI_OUTPUT_ATTEMPTS; attempt++) {
    const reply = await askAi(ai, request, tally);
    if (!reply.ok) return reply;
    const parsed = parse(reply.value.text);
    if (parsed.ok) return ok({ value: parsed.value, model: reply.value.model });
    problem = parsed.error;
  }
  return err(problem);
}

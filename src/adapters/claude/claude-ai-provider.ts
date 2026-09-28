import Anthropic from "@anthropic-ai/sdk";
import { err, ok } from "../../core/domain/result.ts";
import type { AiError, AiProvider } from "../../core/ports/ai-provider.ts";

/** Cheaper Sonnet-class default so a scan costs cents; any model id can be passed instead (ADR 0002). */
export const DEFAULT_MODEL = "claude-sonnet-5";
/** Judging spec against code is the reasoning the product sells, so effort starts high. */
export const DEFAULT_EFFORT: Effort = "high";
/** Requests go only here, whatever ANTHROPIC_BASE_URL says: the user's code must not be rerouted. */
export const ANTHROPIC_API_URL = "https://api.anthropic.com";
const MAX_TOKENS = 16_000;

export type Effort = "low" | "medium" | "high";
export type ClaudeAiProviderOptions = {
  /** The user's own key (BYOK). Required: the adapter never looks for credentials by itself. */
  readonly apiKey: string;
  readonly model?: string;
  readonly effort?: Effort;
  /** For tests: serve recorded responses instead of calling the network. */
  readonly fetch?: typeof globalThis.fetch;
  readonly maxRetries?: number;
};

/** AiProvider over the Anthropic Messages API with the user's key (ADR 0002). */
export function createClaudeAiProvider(options: ClaudeAiProviderOptions): AiProvider {
  const model = options.model ?? DEFAULT_MODEL;
  const effort = options.effort ?? DEFAULT_EFFORT;
  const client = new Anthropic({
    apiKey: options.apiKey,
    // Explicit nulls/values so nothing is picked up from the environment or credential files.
    authToken: null,
    baseURL: ANTHROPIC_API_URL,
    ...(options.fetch ? { fetch: options.fetch } : {}),
    ...(options.maxRetries === undefined ? {} : { maxRetries: options.maxRetries }),
  });

  return {
    async complete(request) {
      try {
        const message = await client.messages.create({
          model,
          max_tokens: MAX_TOKENS,
          system: request.system,
          messages: [{ role: "user", content: request.user }],
          thinking: { type: "adaptive" },
          output_config: {
            effort,
            ...(request.jsonSchema
              ? { format: { type: "json_schema", schema: { ...request.jsonSchema } } }
              : {}),
          },
        });
        if (message.stop_reason === "refusal") {
          return err({ code: "AI_REFUSED", message: `${model} declined to answer this request.` });
        }
        if (
          message.stop_reason === "max_tokens" ||
          message.stop_reason === "model_context_window_exceeded"
        ) {
          return err({
            code: "AI_OUTPUT_TRUNCATED",
            message: `${model}'s answer was cut off (${message.stop_reason}).`,
          });
        }
        const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
        return ok({
          text,
          model: message.model,
          usage: {
            inputTokens: message.usage.input_tokens,
            outputTokens: message.usage.output_tokens,
          },
        });
      } catch (e) {
        return err(translate(e, model));
      }
    },
  };
}

// Typed SDK errors, most specific first; anything that is not an API error is a bug and is rethrown.
function translate(e: unknown, model: string): AiError {
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    return {
      code: "AI_AUTH_FAILED",
      message: "The Anthropic API rejected the API key. Check ANTHROPIC_API_KEY.",
    };
  }
  if (e instanceof Anthropic.RateLimitError) {
    return {
      code: "AI_RATE_LIMITED",
      message: "Rate limited by the Anthropic API, even after retrying. Try again in a minute.",
    };
  }
  if (e instanceof Anthropic.NotFoundError) {
    return {
      code: "AI_MODEL_NOT_FOUND",
      message: `Model "${model}" was not found for this key. Pass another with --model.`,
    };
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return {
      code: "AI_UNAVAILABLE",
      message: "Could not reach api.anthropic.com (network error or timeout).",
    };
  }
  if (e instanceof Anthropic.APIError && (e.status ?? 0) >= 500) {
    return {
      code: "AI_UNAVAILABLE",
      message: `The Anthropic API is unavailable right now (${String(e.status)}).`,
    };
  }
  if (e instanceof Anthropic.APIError) {
    return {
      code: "AI_BAD_REQUEST",
      message: `The Anthropic API rejected the request (${String(e.status)}): ${e.message}`,
    };
  }
  throw e;
}

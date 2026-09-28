import type { AiUsage } from "../../core/ports/ai-provider.ts";

// USD per million tokens, Anthropic list prices as of 2026-06. Shown to users as an estimate of their own spend
// (BYOK); their Anthropic bill is the truth. Thinking tokens are billed as output and are already in output_tokens.
const PRICES: Readonly<Record<string, { readonly input: number; readonly output: number }>> = {
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-fable-5-1": { input: 10, output: 50 },
  "claude-fable-5": { input: 10, output: 50 },
};

/** Estimated USD for the given token usage on a model, or null when the model's price is unknown. */
export function approximateCostUsd(model: string, usage: AiUsage): number | null {
  const price = PRICES[model];
  if (!price) return null;
  return (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000;
}

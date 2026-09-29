import { approximateCostUsd } from "../adapters/claude/pricing.ts";
import type { AiError, AiErrorCode, AiUsage } from "../core/ports/ai-provider.ts";

// Terminal-only advice; the adapter's messages stay neutral because the desktop app shows them too.
const HINT: Partial<Record<AiErrorCode, string>> = {
  AI_AUTH_FAILED: "Check ANTHROPIC_API_KEY.",
  AI_MODEL_NOT_FOUND: "Pass another with --model or AUTOAI_MODEL.",
  AI_OUTPUT_TRUNCATED: "Try --effort medium, which leaves more room for the answer.",
};

/** "Stopped early: CODE - message", plus what to do about it in the terminal. */
export function stoppedLine(error: AiError): string {
  const hint = HINT[error.code];
  return `Stopped early: ${error.code} - ${error.message}${hint === undefined ? "" : ` ${hint}`}`;
}

/** "AI: n calls, x input + y output tokens, about $z" (the cost only when known). */
export function aiUsageLine(
  usage: { readonly aiCalls: number } & AiUsage,
  costUsd: number | null,
): string {
  if (usage.aiCalls === 0) return "AI: 0 calls";
  const tokens = `${usage.inputTokens.toLocaleString("en-US")} input + ${usage.outputTokens.toLocaleString("en-US")} output tokens`;
  const cost = costUsd === null ? "" : `, about $${costUsd.toFixed(2)}`;
  return `AI: ${String(usage.aiCalls)} calls, ${tokens}${cost}`;
}

/** Estimated cost of a run, when exactly one model with a known price was used. */
export function runCostUsd(models: readonly string[], usage: AiUsage): number | null {
  const [only] = models;
  return models.length === 1 && only !== undefined ? approximateCostUsd(only, usage) : null;
}

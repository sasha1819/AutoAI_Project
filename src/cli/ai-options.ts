import { z } from "zod";
import type { ClaudeAiProviderOptions, Effort } from "../adapters/claude/claude-ai-provider.ts";

export const KEY_HELP =
  "Set ANTHROPIC_API_KEY to your own Anthropic API key. AutoAI is bring-your-own-key: the key, and the code it sends, go only from this machine to api.anthropic.com.";

const ApiKey = z.string().trim().min(1);
const ModelEnv = z.string().trim().min(1);

/**
 * The Claude settings for a CLI run (ADR 0002): the user's own key from ANTHROPIC_API_KEY (null when missing),
 * the model from --model, else AUTOAI_MODEL, else the adapter default, and the effort from --effort.
 */
export function readAiOptions(
  env: Readonly<Record<string, string | undefined>>,
  flags: { readonly model?: string | undefined; readonly effort?: Effort | undefined },
): ClaudeAiProviderOptions | null {
  const key = ApiKey.safeParse(env["ANTHROPIC_API_KEY"]);
  if (!key.success) return null;
  const envModel = ModelEnv.safeParse(env["AUTOAI_MODEL"]);
  const model = flags.model ?? (envModel.success ? envModel.data : undefined);
  return {
    apiKey: key.data,
    ...(model === undefined ? {} : { model }),
    ...(flags.effort === undefined ? {} : { effort: flags.effort }),
  };
}

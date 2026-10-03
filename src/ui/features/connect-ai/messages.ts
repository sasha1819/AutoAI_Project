import type { ChannelResponse } from "../../../contracts/channels.ts";

type FailureCode<R> = R extends { readonly ok: false; readonly error: { readonly code: infer C } }
  ? C
  : never;
export type SaveKeyCode = FailureCode<ChannelResponse<"ai:save-key">>;
export type StatusCode = FailureCode<ChannelResponse<"ai:status">>;

/**
 * What each failure means to the user, in words, with what to do next. One entry per code in the contract: a new
 * code does not compile until it has its words. Nothing here retries: the user decides.
 */
const COULD_NOT_CHECK =
  "Anthropic couldn't check this key. Try again, or create a new key in your Anthropic Console.";

export const SAVE_KEY_MESSAGE: Record<SaveKeyCode, string> = {
  KEY_INVALID:
    "That doesn't look like an API key. Check that you copied all of it, with no spaces.",
  AI_AUTH_FAILED:
    "Anthropic didn't accept this key. Check it, or create a new one in your Anthropic Console.",
  AI_RATE_LIMITED: "Anthropic is busy right now and couldn't check the key. Try again in a minute.",
  AI_UNAVAILABLE:
    "Couldn't reach Anthropic to check the key. Check your internet connection, then try again.",
  AI_MODEL_NOT_FOUND: COULD_NOT_CHECK,
  AI_BAD_REQUEST: COULD_NOT_CHECK,
  AI_REFUSED: COULD_NOT_CHECK,
  AI_OUTPUT_TRUNCATED: COULD_NOT_CHECK,
  SECRET_STORE_UNAVAILABLE:
    "The key works, but this computer can't store it securely (no system keychain), so it wasn't saved.",
  SECRET_STORE_FAILED: "The key works, but it couldn't be saved on this computer. Try again.",
};

export const STATUS_MESSAGE: Record<StatusCode, string> = {
  SECRET_STORE_UNAVAILABLE:
    "This computer can't read a saved key (no system keychain). Enter your key to continue.",
  SECRET_STORE_FAILED: "The saved key couldn't be read. Enter your key again to continue.",
};

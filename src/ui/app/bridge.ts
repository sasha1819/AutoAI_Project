import type { AutoAiBridge } from "../../contracts/channels.ts";

declare global {
  interface Window {
    /** Set by the preload (ADR 0007). Absent in Storybook and tests, where screens get a fake. */
    readonly autoai?: AutoAiBridge;
  }
}

/** The bridge to main. Each feature's one hook calls this; nothing else in the screens touches it. */
export function bridge(): AutoAiBridge {
  const found = window.autoai;
  if (found === undefined)
    throw new Error("window.autoai is missing: the app was not opened through its preload");
  return found;
}

/**
 * What a screen says when a reply breaks its contract, or there is no preload: a bug, not an expected failure. The
 * screen must not hang on it, so it says so plainly; the error itself is still reported (console), not swallowed.
 */
export const BROKEN_MESSAGE = "Something went wrong inside AutoAI. Restart it and try again.";

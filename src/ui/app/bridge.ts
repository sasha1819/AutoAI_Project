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

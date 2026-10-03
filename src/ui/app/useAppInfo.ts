import { useEffect, useState } from "react";
import { bridge } from "./bridge.ts";

export type AppInfo = { readonly mockAi: boolean };

/** How the app is running (app:info), asked once when it opens: today, whether the mock AI is on (dev only). */
export function useAppInfo(): AppInfo {
  const [mockAi, setMockAi] = useState(false);
  useEffect(() => {
    let live = true;
    const ask = async () => {
      try {
        const info = await bridge().invoke("app:info", {});
        if (live) setMockAi(info.mockAi);
      } catch (e) {
        // Not knowing only hides the marker; it is reported, not swallowed.
        console.error(e);
      }
    };
    void ask();
    return () => {
      live = false;
    };
  }, []);
  return { mockAi };
}

import { useEffect, useRef, useState } from "react";
import { EmptyState } from "../design-system/primitives/EmptyState/index.ts";
import { ToastProvider } from "../design-system/primitives/Toast/index.ts";
import { ConnectAi } from "../features/connect-ai/index.ts";
import { WelcomeView } from "../features/welcome/index.ts";

/** The onboarding steps of PRD Flow 1, in order. Screens are added here one at a time (M5). */
type Screen = "welcome" | "connect-ai" | "add-project";

/**
 * The app's root: providers shared by every screen, and which screen shows. When the screen changes, focus moves
 * to the new screen's heading, so keyboard and screen-reader users land on it (the control they used is gone).
 */
export function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);
  useEffect(() => {
    // Not on the first screen: the window opening is not a change the user made.
    if (first.current) {
      first.current = false;
      return;
    }
    const heading = main.current?.querySelector<HTMLElement>("h1, h2");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }, [screen]);
  return (
    <ToastProvider>
      <main
        ref={main}
        className="h-screen overflow-auto bg-canvas text-text-primary"
        aria-label="AutoAI"
      >
        {screen === "welcome" && (
          <WelcomeView
            onGetStarted={() => {
              setScreen("connect-ai");
            }}
          />
        )}
        {screen === "connect-ai" && (
          <ConnectAi
            onContinue={() => {
              setScreen("add-project");
            }}
          />
        )}
        {screen === "add-project" && (
          // Temporary: replaced by the Add project screen (the next M5 step).
          <div className="flex h-full items-center justify-center">
            <EmptyState
              title="Add your project"
              description="This screen is the next one to be built."
            />
          </div>
        )}
      </main>
    </ToastProvider>
  );
}

import { useEffect, useRef, useState } from "react";
import { Badge } from "../design-system/primitives/Badge/index.ts";
import { EmptyState } from "../design-system/primitives/EmptyState/index.ts";
import { ToastProvider } from "../design-system/primitives/Toast/index.ts";
import { AddProject, type ChosenFolders } from "../features/add-project/index.ts";
import { ConnectAi } from "../features/connect-ai/index.ts";
import { WelcomeView } from "../features/welcome/index.ts";
import { useAppInfo } from "./useAppInfo.ts";

/** The onboarding steps of PRD Flow 1, in order. Screens are added here one at a time (M5). */
type Screen = "welcome" | "connect-ai" | "add-project" | "scan";

/**
 * The app's root: providers shared by every screen, and which screen shows. When the screen changes, focus moves
 * to the new screen's heading, so keyboard and screen-reader users land on it (the control they used is gone).
 */
export function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  // Kept here so a visit to Connect Claude from Add project does not lose the chosen folders.
  const [folders, setFolders] = useState<ChosenFolders>({ repoFolder: null, prdFolder: null });
  const { mockAi } = useAppInfo();
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
      {mockAi && (
        // Development only: on every screen, so a mock connection is never mistaken for a real one.
        <div
          className="fixed top-3 right-3 z-50"
          role="note"
          aria-label="Mock AI mode: no real AI calls, keys kept in memory only"
        >
          <Badge label="Mock AI" uppercase />
        </div>
      )}
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
            onSetUpLater={() => {
              setScreen("add-project");
            }}
          />
        )}
        {screen === "add-project" && (
          <AddProject
            folders={folders}
            onFoldersChange={setFolders}
            onScan={() => {
              setScreen("scan");
            }}
            onConnectAi={() => {
              setScreen("connect-ai");
            }}
          />
        )}
        {screen === "scan" && (
          // Temporary: replaced by the scan progress screen (the next M5 step), which will keep the Project that
          // onScan receives (dropped here). Nothing is scanned yet.
          <div className="flex h-full items-center justify-center">
            <EmptyState
              title="Next: scan progress"
              description="This screen is the next one to be built."
            />
          </div>
        )}
      </main>
    </ToastProvider>
  );
}

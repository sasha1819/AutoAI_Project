import { ToastProvider } from "../design-system/primitives/Toast/index.ts";

/**
 * The app's root: providers shared by every screen. The screens (Welcome first) are added here one at a time in
 * M5; until then the window shows the app background only.
 */
export function App() {
  return (
    <ToastProvider>
      <main className="min-h-screen bg-canvas text-text-primary" aria-label="AutoAI" />
    </ToastProvider>
  );
}

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App.tsx";
import { bridge } from "./bridge.ts";

describe("App shell", () => {
  it("renders the app's main region with the shared providers", () => {
    render(<App />);
    expect(screen.getByRole("main", { name: "AutoAI" })).toBeTruthy();
    // The Toast announcer (polite live region) is on the page from the start.
    expect(document.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull();
  });

  it("bridge() fails loudly when the page was not opened through the preload", () => {
    expect(() => bridge()).toThrow(/window.autoai is missing/);
  });
});

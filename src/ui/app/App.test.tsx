import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("opens on Welcome without moving focus; Get started moves on and focuses the next screen", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "AutoAI" })).toBeTruthy();
    expect(document.activeElement).toBe(document.body);
    await user.click(screen.getByRole("button", { name: "Get started" }));
    expect(screen.queryByRole("heading", { level: 1, name: "AutoAI" })).toBeNull();
    const next = screen.getByRole("heading", { name: "Connect Claude" });
    // The button that was used is gone: focus lands on the new screen's heading.
    expect(document.activeElement).toBe(next);
  });

  it("bridge() fails loudly when the page was not opened through the preload", () => {
    expect(() => bridge()).toThrow(/window.autoai is missing/);
  });
});

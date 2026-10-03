import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App.tsx";
import type { ChannelResponse } from "../../contracts/channels.ts";
import { bridge } from "./bridge.ts";
import { installFakeBridge, removeFakeBridge } from "./testing/fake-bridge.ts";

describe("App shell", () => {
  afterEach(() => {
    removeFakeBridge();
  });

  it("renders the app's main region with the shared providers", () => {
    installFakeBridge({ "app:info": () => Promise.resolve({ mockAi: false }) });
    render(<App />);
    expect(screen.getByRole("main", { name: "AutoAI" })).toBeTruthy();
    // The Toast announcer (polite live region) is on the page from the start.
    expect(document.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull();
  });

  it("opens on Welcome without moving focus; Get started moves to Connect Claude and focuses its heading", async () => {
    const user = userEvent.setup();
    installFakeBridge({
      "ai:status": () =>
        Promise.resolve<ChannelResponse<"ai:status">>({ ok: true, value: { configured: true } }),
    });
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "AutoAI" })).toBeTruthy();
    expect(document.activeElement).toBe(document.body);
    await user.click(screen.getByRole("button", { name: "Get started" }));
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { level: 1, name: "Connect Claude" }),
    );
    await user.click(await screen.findByRole("button", { name: "Continue" }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Add your project" }));
  });

  it("mock AI mode: a visible MOCK AI marker on the screen; none otherwise", async () => {
    installFakeBridge({ "app:info": () => Promise.resolve({ mockAi: true }) });
    const { unmount } = render(<App />);
    expect(
      await screen.findByRole("note", {
        name: "Mock AI mode: no real AI calls, keys kept in memory only",
      }),
    ).toBeTruthy();
    expect(screen.getByText("Mock AI").className).toContain("uppercase");
    unmount();
    installFakeBridge({ "app:info": () => Promise.resolve({ mockAi: false }) });
    render(<App />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText("Mock AI")).toBeNull();
  });

  it("bridge() fails loudly when the page was not opened through the preload", () => {
    expect(() => bridge()).toThrow(/window.autoai is missing/);
  });
});

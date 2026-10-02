import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toast } from "./Toast.tsx";
import { INFO_TOAST_MS, type ToastApi, ToastProvider, useToast } from "./ToastProvider.tsx";

// Captures the api so a test can show toasts like a screen would.
function setup(): { readonly api: () => ToastApi } {
  let api: ToastApi | undefined;
  function Grab() {
    api = useToast();
    return null;
  }
  render(
    <ToastProvider>
      <Grab />
    </ToastProvider>,
  );
  return {
    api: () => {
      if (api === undefined) throw new Error("no api");
      return api;
    },
  };
}
const notifications = () => screen.queryByRole("region", { name: "Notifications" });

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("announces through live regions that were already on the page", () => {
    const { api } = setup();
    const polite = screen.getByRole("status");
    const assertive = screen.getByRole("alert");
    expect(polite.textContent).toBe("");
    act(() => {
      api().show({ title: "File saved", description: "Two tests written" });
      api().show({ title: "Run could not start", kind: "error" });
    });
    expect(polite.textContent).toBe("File saved. Two tests written");
    expect(assertive.textContent).toBe("Error: Run could not start");
  });

  it("shows cards in a Notifications region that is not itself live (no double reading)", () => {
    const { api } = setup();
    expect(notifications()).toBeNull();
    act(() => {
      api().show({ title: "File saved" });
    });
    const region = notifications();
    if (region === null) throw new Error("no region");
    expect(within(region).getByText("File saved")).toBeTruthy();
    expect(region.hasAttribute("aria-live")).toBe(false);
  });

  it("info closes by itself; an error stays until dismissed", () => {
    const { api } = setup();
    act(() => {
      api().show({ title: "File saved" });
      api().show({ title: "Run could not start", kind: "error" });
    });
    act(() => {
      vi.advanceTimersByTime(INFO_TOAST_MS);
    });
    expect(screen.queryByText("File saved")).toBeNull();
    const region = notifications();
    if (region === null) throw new Error("no region");
    fireEvent.click(within(region).getByRole("button", { name: "Dismiss notification" }));
    expect(notifications()).toBeNull();
  });

  it("does not close while the pointer or focus is on the toasts", () => {
    const { api } = setup();
    act(() => {
      api().show({ title: "File saved" });
    });
    const region = notifications();
    if (region === null) throw new Error("no region");
    fireEvent.mouseEnter(region);
    act(() => {
      vi.advanceTimersByTime(INFO_TOAST_MS * 3);
    });
    expect(screen.getAllByText("File saved").length).toBeGreaterThan(0);
    fireEvent.mouseLeave(region);
    act(() => {
      vi.advanceTimersByTime(INFO_TOAST_MS);
    });
    expect(notifications()).toBeNull();
  });

  it("dismiss(id) closes that one only", () => {
    const { api } = setup();
    let first = 0;
    act(() => {
      first = api().show({ title: "First", kind: "error" });
      api().show({ title: "Second", kind: "error" });
    });
    act(() => {
      api().dismiss(first);
    });
    const region = notifications();
    if (region === null) throw new Error("no region");
    expect(within(region).queryByText("First")).toBeNull();
    expect(within(region).getByText("Second")).toBeTruthy();
  });

  it("useToast outside a provider throws instead of dropping messages", () => {
    function Lonely() {
      useToast();
      return null;
    }
    expect(() => render(<Lonely />)).toThrow("useToast needs a ToastProvider");
  });

  // The ts-expect-error lines are checked at typecheck time (part of verify); a blank title also throws at runtime.
  it("cannot be blank", () => {
    const fromData: string = " ";
    expect(() => render(<Toast title={fromData} kind="info" onDismiss={vi.fn()} />)).toThrow(
      "Toast needs a non-empty label",
    );
    const { api } = setup();
    // @ts-expect-error a toast with no words
    expect(() => act(() => api().show({ title: "" }))).toThrow(/label/);
  });

  it("an error card says so in visible words, not by colour", () => {
    render(<Toast title="Run could not start" kind="error" onDismiss={vi.fn()} />);
    expect(screen.getByText("Error")).toBeTruthy();
  });

  it("each live region holds only its newest message, so open ones are not read again", () => {
    const { api } = setup();
    act(() => {
      api().show({ title: "First failure", kind: "error" });
      api().show({ title: "Second failure", kind: "error" });
    });
    expect(screen.getByRole("alert").textContent).toBe("Error: Second failure");
  });

  it("a pause does not stick when the last toast is dismissed under the pointer", () => {
    const { api } = setup();
    act(() => {
      api().show({ title: "Old" });
    });
    const region = notifications();
    if (region === null) throw new Error("no region");
    fireEvent.mouseEnter(region);
    fireEvent.click(within(region).getByRole("button", { name: "Dismiss notification" }));
    expect(notifications()).toBeNull();
    act(() => {
      api().show({ title: "New" });
    });
    act(() => {
      vi.advanceTimersByTime(INFO_TOAST_MS);
    });
    expect(notifications()).toBeNull();
  });

  it("a new toast does not extend an older one's time; a pause keeps the time left", () => {
    const { api } = setup();
    act(() => {
      api().show({ title: "Older" });
    });
    act(() => {
      vi.advanceTimersByTime(INFO_TOAST_MS - 1000);
      api().show({ title: "Newer" });
    });
    const region = notifications();
    if (region === null) throw new Error("no region");
    fireEvent.mouseEnter(region);
    act(() => {
      vi.advanceTimersByTime(INFO_TOAST_MS * 2);
    });
    fireEvent.mouseLeave(region);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(within(region).queryByText("Older")).toBeNull();
    expect(within(region).getByText("Newer")).toBeTruthy();
  });

  it("keyboard: F6 reaches the newest toast, Escape dismisses it, focus moves on and then returns", () => {
    const { api } = setup();
    const outside = document.createElement("button");
    document.body.append(outside);
    act(() => {
      outside.focus();
      api().show({ title: "First", kind: "error" });
      api().show({ title: "Second", kind: "error" });
    });
    fireEvent.keyDown(window, { key: "F6" });
    const region = notifications();
    if (region === null) throw new Error("no region");
    const [firstDismiss, secondDismiss] = within(region).getAllByRole("button", {
      name: "Dismiss notification",
    });
    expect(document.activeElement).toBe(secondDismiss);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(within(region).queryByText("Second")).toBeNull();
    expect(document.activeElement).toBe(firstDismiss);
    fireEvent.click(firstDismiss ?? document.body);
    expect(notifications()).toBeNull();
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });
});

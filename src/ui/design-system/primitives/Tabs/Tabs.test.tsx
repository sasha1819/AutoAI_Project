import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { type TabItem, Tabs } from "./Tabs.tsx";

type V = "one" | "two" | "three";
const items: readonly TabItem<V>[] = [
  { value: "one", label: "First", content: <p>First panel</p> },
  { value: "two", label: "Second", content: <p>Second panel</p>, count: 3 },
  { value: "three", label: "Third", content: <p>Third panel</p> },
];

describe("Tabs", () => {
  it("is a named tab list; the first tab is selected and only its panel is rendered", () => {
    render(<Tabs label="Details" items={items} />);
    const list = screen.getByRole("tablist", { name: "Details" });
    const tabs = within(list).getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toBe("First panel");
    expect(screen.queryByText("Second panel")).toBeNull();
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(tabs[0]?.id);
  });

  it("names a tab with its count, read once (the reserved bold copy is hidden)", () => {
    render(<Tabs label="Details" items={items} />);
    expect(screen.getByRole("tab", { name: "Second 3" })).toBeTruthy();
  });

  it("keyboard: arrows move and select, wrapping; Home and End jump; Tab enters the panel", async () => {
    const user = userEvent.setup();
    render(<Tabs label="Details" items={items} />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "First" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Second 3" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByRole("tabpanel").textContent).toBe("Second panel");
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Third" }));
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "First" }));
    await user.keyboard("{Home}{ArrowLeft}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Third" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("tabpanel"));
  });

  it("skips a disabled tab by keyboard and ignores it by pointer", async () => {
    const user = userEvent.setup();
    render(
      <Tabs
        label="Details"
        items={items.map((i) => (i.value === "two" ? { ...i, disabled: true } : i))}
      />,
    );
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Third" }));
    await user.click(screen.getByRole("tab", { name: "Second 3" }));
    expect(screen.getByRole("tabpanel").textContent).toBe("Third panel");
  });

  it("starts on the first enabled tab", () => {
    render(
      <Tabs
        label="Details"
        items={items.map((i) => (i.value === "one" ? { ...i, disabled: true } : i))}
      />,
    );
    expect(screen.getByRole("tabpanel").textContent).toBe("Second panel");
  });

  it("controlled: reports the typed value and shows what it is given", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn<(v: V) => void>();
    const { rerender } = render(
      <Tabs label="Details" items={items} value="one" onValueChange={onValueChange} />,
    );
    await user.click(screen.getByRole("tab", { name: "Third" }));
    expect(onValueChange).toHaveBeenCalledWith("three");
    expect(screen.getByRole("tabpanel").textContent).toBe("First panel");
    rerender(<Tabs label="Details" items={items} value="three" onValueChange={onValueChange} />);
    expect(screen.getByRole("tabpanel").textContent).toBe("Third panel");
  });

  it.each([
    ["no tabs", [], /at least one tab/],
    ["a blank label", [{ value: "a", label: " ", content: null }], /non-blank label/],
    ["a blank value", [{ value: " ", label: "A", content: null }], /non-blank value/],
    [
      "a repeated value",
      [
        { value: "a", label: "A", content: null },
        { value: "a", label: "B", content: null },
      ],
      /used twice/,
    ],
    [
      "a repeated label (case and spacing ignored)",
      [
        { value: "a", label: "Logs", content: null },
        { value: "b", label: " logs ", content: null },
      ],
      /used twice/,
    ],
    [
      "only disabled tabs",
      [{ value: "a", label: "A", content: null, disabled: true }],
      /must be enabled/,
    ],
    [
      "a repeated label hidden by a zero-width space",
      [
        { value: "a", label: "Logs", content: null },
        { value: "b", label: "Logs\u200b", content: null },
      ],
      /used twice/,
    ],
    ["a negative count", [{ value: "a", label: "A", content: null, count: -1 }], /whole number/],
    ["a fractional count", [{ value: "a", label: "A", content: null, count: 2.5 }], /whole number/],
    [
      "a count that is not a number",
      [{ value: "a", label: "A", content: null, count: Number.NaN }],
      /whole number/,
    ],
  ])("refuses %s", (_name, bad, message) => {
    expect(() => render(<Tabs label="Details" items={bad} />)).toThrow(message);
  });

  it("refuses a value that is not a tab", () => {
    const fromData: string = "missing";
    expect(() =>
      render(<Tabs label="Details" items={items} defaultValue={fromData as V} />),
    ).toThrow(/not one of/);
  });

  // The ts-expect-error lines are checked at typecheck time (part of verify); a blank name also throws at runtime.
  it("must be named, and takes no outside class or aria", () => {
    const blank: string = " ";
    expect(() => render(<Tabs label={blank} items={items} />)).toThrow(
      "Tabs needs a non-empty label",
    );
    // @ts-expect-error a tab list without a name
    expect(() => render(<Tabs items={items} />)).toThrow(/label/);
    expect(() =>
      // @ts-expect-error a value that is not one of the typed values (and throws at runtime)
      render(<Tabs label="A" items={items} value="four" onValueChange={vi.fn()} />),
    ).toThrow(/not one of/);
    // @ts-expect-error a controlled value without onValueChange could never change
    render(<Tabs label="B" items={items} value="one" />);
    // @ts-expect-error controlled and uncontrolled at once
    render(<Tabs label="C" items={items} value="one" onValueChange={vi.fn()} defaultValue="two" />);
  });
});

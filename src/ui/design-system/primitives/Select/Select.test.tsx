import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Select, type SelectOption } from "./Select.tsx";

const OPTIONS: readonly SelectOption[] = [
  { value: "day", label: "Last 24 hours" },
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "Last 30 days", disabled: true },
  { value: "all", label: "All time" },
];

/** The text of the elements a control's aria-describedby points at, in order. */
function description(element: HTMLElement): string {
  return (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter((id) => id !== "")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" | ");
}

describe("Select", () => {
  it("closed: a combobox named by its label, showing the placeholder", () => {
    render(<Select label="Period" options={OPTIONS} placeholder="Choose a period" />);
    const trigger = screen.getByRole("combobox", { name: "Period" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.textContent).toContain("Choose a period");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  // Checked at typecheck time (part of verify): each @ts-expect-error fails the build if the rule loosens.
  it("cannot be built without a name", () => {
    // @ts-expect-error no label: announced as just "combo box"
    expect(() => render(<Select options={OPTIONS} />)).toThrow(/label/);
    // @ts-expect-error an empty label is no name either
    expect(() => render(<Select label="" options={OPTIONS} />)).toThrow(/label/);
    const fromData: string = "​";
    expect(() => render(<Select label={fromData} options={OPTIONS} />)).toThrow(
      "Select needs a non-empty label",
    );
  });

  it("refuses options a person could not tell apart or pick: blank labels or values, repeated values", () => {
    expect(() => render(<Select label="Period" options={[{ value: "a", label: " " }]} />)).toThrow(
      /option/,
    );
    expect(() =>
      render(<Select label="Period" options={[{ value: "", label: "Empty" }]} />),
    ).toThrow(/option/);
    expect(() =>
      render(
        <Select
          label="Period"
          options={[
            { value: "a", label: "One" },
            { value: "a", label: "Two" },
          ]}
        />,
      ),
    ).toThrow(/option/);
    expect(() =>
      render(
        <Select
          label="Period"
          options={[
            { value: "a", label: "Same" },
            { value: "b", label: " same " },
          ]}
        />,
      ),
    ).toThrow(/label "/);
  });

  it("refuses a value that is not one of the options (the trigger would show nothing)", () => {
    expect(() => render(<Select label="Period" options={OPTIONS} defaultValue="nope" />)).toThrow(
      'Select value "nope" is not one of its option values',
    );
    expect(() => render(<Select label="Period" options={OPTIONS} value="nope" />)).toThrow(
      /not one of/,
    );
  });

  it("a blank placeholder or empty text falls back to the default wording", () => {
    render(<Select label="Period" options={OPTIONS} placeholder=" " />);
    expect(screen.getByRole("combobox", { name: "Period" }).textContent).toContain("Choose one");
    render(<Select label="Browser" options={[]} emptyText={"\u200B"} />);
    expect(screen.getByRole("combobox", { name: "Browser" }).textContent).toContain(
      "Nothing to choose from",
    );
  });

  it("keyboard: opens with Enter, skips disabled options, picks with Enter, and returns focus", async () => {
    const onValueChange = vi.fn();
    render(<Select label="Period" options={OPTIONS} onValueChange={onValueChange} />);
    const user = userEvent.setup();
    await user.tab();
    const trigger = screen.getByRole("combobox", { name: "Period" });
    expect(document.activeElement).toBe(trigger);

    await user.keyboard("{Enter}");
    const listbox = screen.getByRole("listbox");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(
      within(listbox)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toStrictEqual(OPTIONS.map((o) => o.label));

    // From the first option: down to the second, then past the disabled third to the fourth.
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("all");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger.textContent).toContain("All time");
    expect(document.activeElement).toBe(trigger);
  });

  it("keyboard: Escape closes without changing the value", async () => {
    const onValueChange = vi.fn();
    render(
      <Select label="Period" options={OPTIONS} defaultValue="week" onValueChange={onValueChange} />,
    );
    const user = userEvent.setup();
    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeDefined();
    await user.keyboard("{ArrowDown}{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onValueChange).not.toHaveBeenCalled();
    const trigger = screen.getByRole("combobox", { name: "Period" });
    expect(trigger.textContent).toContain("Last 7 days");
    expect(document.activeElement).toBe(trigger);
  });

  it("keyboard: the list opens on the current value, named like the select; ArrowUp skips disabled; Home/End jump", async () => {
    const onValueChange = vi.fn();
    render(
      <Select label="Period" options={OPTIONS} defaultValue="all" onValueChange={onValueChange} />,
    );
    const user = userEvent.setup();
    await user.tab();
    await user.keyboard("{Enter}");
    const listbox = screen.getByRole("listbox", { name: "Period" });
    const current = within(listbox).getByRole("option", { name: "All time" });
    expect(current.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(current);

    // Up from the last option skips the disabled third and lands on the second.
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(
      within(listbox).getByRole("option", { name: "Last 7 days" }),
    );
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(
      within(listbox).getByRole("option", { name: "Last 24 hours" }),
    );
    await user.keyboard("{End}{Enter}");
    expect(onValueChange).not.toHaveBeenCalled(); // End lands on the current value: choosing it again is no change
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("a disabled option is marked so and cannot be picked by pointer", async () => {
    const onValueChange = vi.fn();
    render(<Select label="Period" options={OPTIONS} onValueChange={onValueChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Period" }));
    const disabled = screen.getByRole("option", { name: "Last 30 days" });
    expect(disabled.getAttribute("aria-disabled")).toBe("true");
    await user.click(disabled);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("hug width: as wide as its value, for toolbar filters", () => {
    render(<Select label="Period" hideLabel width="hug" options={OPTIONS} defaultValue="week" />);
    const trigger = screen.getByRole("combobox", { name: "Period" });
    expect(trigger.className).toContain("w-auto");
    expect(trigger.className).not.toContain("w-full");
  });

  it("pointer: opens on click and picks the clicked option", async () => {
    const onValueChange = vi.fn();
    render(<Select label="Period" options={OPTIONS} onValueChange={onValueChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Period" }));
    await user.click(screen.getByRole("option", { name: "Last 24 hours" }));
    expect(onValueChange).toHaveBeenCalledWith("day");
  });

  it("works controlled", async () => {
    function Controlled() {
      const [value, setValue] = useState("day");
      return (
        <>
          <Select label="Period" options={OPTIONS} value={value} onValueChange={setValue} />
          <output>{value}</output>
        </>
      );
    }
    render(<Controlled />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Period" }));
    await user.click(screen.getByRole("option", { name: "All time" }));
    expect(screen.getByRole("status").textContent).toBe("all");
  });

  it('controlled: value "" means nothing chosen, so a reset shows the placeholder again', async () => {
    function Resettable() {
      const [value, setValue] = useState("");
      return (
        <>
          <Select
            label="Period"
            options={OPTIONS}
            value={value}
            onValueChange={setValue}
            placeholder="Any period"
          />
          <button
            type="button"
            onClick={() => {
              setValue("");
            }}
          >
            Reset
          </button>
        </>
      );
    }
    render(<Resettable />);
    const trigger = screen.getByRole("combobox", { name: "Period" });
    expect(trigger.textContent).toContain("Any period");
    const user = userEvent.setup();
    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: "All time" }));
    expect(trigger.textContent).toContain("All time");
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(trigger.textContent).toContain("Any period");
  });

  it("disabled: cannot be focused or opened", async () => {
    render(<Select label="Period" options={OPTIONS} disabled />);
    const trigger = screen.getByRole("combobox", { name: "Period" });
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(document.body);
    await user.click(trigger);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("error: marked invalid, the error read before the hint", () => {
    render(
      <Select label="Model" options={OPTIONS} hint="Used for every scan" error="Pick a model" />,
    );
    const trigger = screen.getByRole("combobox", { name: "Model" });
    expect(trigger.getAttribute("aria-invalid")).toBe("true");
    expect(description(trigger)).toBe("Pick a model | Used for every scan");
  });

  it("empty: no options means a disabled select that says so, still named", () => {
    render(<Select label="Browser" options={[]} />);
    const trigger = screen.getByRole("combobox", { name: "Browser" });
    expect(trigger).toHaveProperty("disabled", true);
    expect(trigger.textContent).toContain("Nothing to choose from");
  });

  it("keeps its name, description, validity and visibility: outside aria attributes change nothing", () => {
    render(
      <>
        <span id="other">Something else</span>
        <Select
          label="Period"
          options={OPTIONS}
          hint="How far back"
          aria-label=""
          aria-labelledby="other"
          aria-describedby="other"
          aria-description="Injected"
          aria-invalid
          aria-hidden
          aria-errormessage="other"
        />
      </>,
    );
    const trigger = screen.getByRole("combobox", { name: "Period" });
    expect(description(trigger)).toBe("How far back");
    for (const attribute of [
      "aria-description",
      "aria-invalid",
      "aria-hidden",
      "aria-errormessage",
    ]) {
      expect(trigger.getAttribute(attribute), attribute).toBeNull();
    }
  });

  // Checked at typecheck time (part of verify). One render each: TypeScript reports only the first unknown prop of a
  // JSX element. Select spreads nothing, so even a forced value never reaches the control.
  it("does not accept hidden, inert, title or role", () => {
    // @ts-expect-error hidden would hide the control and leave its label on screen
    render(<Select label="Period" options={OPTIONS} hidden />);
    // @ts-expect-error inert would remove it from focus and from the screen reader
    render(<Select label="Period" options={OPTIONS} inert />);
    // @ts-expect-error title would become its description
    render(<Select label="Period" options={OPTIONS} title="Injected" />);
    // @ts-expect-error role would change what it is announced as
    render(<Select label="Period" options={OPTIONS} role="img" />);
    for (const trigger of screen.getAllByRole("combobox", { name: "Period" })) {
      for (const attribute of ["hidden", "inert", "title"])
        expect(trigger.getAttribute(attribute)).toBeNull();
    }
  });

  it("gives every select its own ids", () => {
    render(
      <>
        <Select label="First" options={OPTIONS} hint="One" />
        <Select label="Second" options={OPTIONS} hint="Two" />
      </>,
    );
    expect(description(screen.getByRole("combobox", { name: "First" }))).toBe("One");
    expect(description(screen.getByRole("combobox", { name: "Second" }))).toBe("Two");
  });
});

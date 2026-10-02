import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox, type CheckboxState } from "./Checkbox.tsx";

/** The text of the elements a control's aria-describedby points at, in order. */
function description(element: HTMLElement): string {
  return (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter((id) => id !== "")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" | ");
}

describe("Checkbox", () => {
  it("is a checkbox named by its label beside it, unchecked by default", () => {
    render(<Checkbox label="Include flaky tests" />);
    const box = screen.getByRole("checkbox", { name: "Include flaky tests" });
    expect(box.getAttribute("aria-checked")).toBe("false");
  });

  it("keeps its name with a visually hidden label", () => {
    render(<Checkbox label="Select row" hideLabel />);
    expect(screen.getByRole("checkbox", { name: "Select row" })).toBeDefined();
    expect(screen.getByText("Select row").className).toContain("sr-only");
  });

  // Checked at typecheck time (part of verify): each @ts-expect-error fails the build if the rule loosens.
  it("cannot be built without a name", () => {
    // @ts-expect-error no label: announced as just "checkbox"
    expect(() => render(<Checkbox />)).toThrow(/label/);
    // @ts-expect-error an empty label is no name either
    expect(() => render(<Checkbox label="" />)).toThrow(/label/);
    const fromData: string = "​";
    expect(() => render(<Checkbox label={fromData} />)).toThrow("Checkbox needs a non-empty label");
  });

  it("keyboard: Space toggles it; Enter does nothing (WAI-ARIA checkbox pattern, as a native checkbox)", async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Include flaky tests" onCheckedChange={onCheckedChange} />);
    const box = screen.getByRole("checkbox", { name: "Include flaky tests" });
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(box);
    await user.keyboard(" ");
    expect(box.getAttribute("aria-checked")).toBe("true");
    await user.keyboard("{Enter}");
    expect(box.getAttribute("aria-checked")).toBe("true");
    await user.keyboard(" ");
    expect(box.getAttribute("aria-checked")).toBe("false");
    expect(onCheckedChange.mock.calls).toStrictEqual([[true], [false]]);
  });

  it("pointer: clicking the box or its label toggles it", async () => {
    render(<Checkbox label="Include flaky tests" />);
    const box = screen.getByRole("checkbox", { name: "Include flaky tests" });
    const user = userEvent.setup();
    await user.click(box);
    expect(box.getAttribute("aria-checked")).toBe("true");
    await user.click(screen.getByText("Include flaky tests"));
    expect(box.getAttribute("aria-checked")).toBe("false");
  });

  it("disabled: the label dims too and stops looking clickable", () => {
    render(<Checkbox label="Second" disabled />);
    expect(screen.getByText("Second").className).toContain("cursor-not-allowed");
  });

  it("tab order: follows the page, and skips a disabled checkbox", async () => {
    render(
      <>
        <Checkbox label="First" />
        <Checkbox label="Second" disabled />
        <Checkbox label="Third" />
      </>,
    );
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("checkbox", { name: "First" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("checkbox", { name: "Third" }));
  });

  it("disabled: cannot be toggled by pointer or keyboard", async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Second" disabled defaultChecked onCheckedChange={onCheckedChange} />);
    const box = screen.getByRole("checkbox", { name: "Second" });
    await userEvent.setup().click(box);
    expect(box.getAttribute("aria-checked")).toBe("true");
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it('indeterminate: announced as "mixed", and a press makes it checked', async () => {
    const onCheckedChange = vi.fn();
    render(
      <Checkbox
        label="All tests"
        defaultChecked="indeterminate"
        onCheckedChange={onCheckedChange}
      />,
    );
    const box = screen.getByRole("checkbox", { name: "All tests" });
    expect(box.getAttribute("aria-checked")).toBe("mixed");
    await userEvent.setup().click(box);
    expect(box.getAttribute("aria-checked")).toBe("true");
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("works controlled, including a parent that sets it to mixed", async () => {
    function Controlled() {
      const [state, setState] = useState<CheckboxState>("indeterminate");
      return (
        <>
          <Checkbox label="All tests" checked={state} onCheckedChange={setState} />
          <button
            type="button"
            onClick={() => {
              setState("indeterminate");
            }}
          >
            Some
          </button>
        </>
      );
    }
    render(<Controlled />);
    const box = screen.getByRole("checkbox", { name: "All tests" });
    const user = userEvent.setup();
    await user.click(box);
    expect(box.getAttribute("aria-checked")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Some" }));
    expect(box.getAttribute("aria-checked")).toBe("mixed");
  });

  it("required and error: announced as required and invalid, the error read before the hint", () => {
    render(
      <Checkbox label="I understand" required hint="Needed to continue" error="Please confirm" />,
    );
    const box = screen.getByRole("checkbox", { name: "I understand" });
    expect(box.getAttribute("aria-required")).toBe("true");
    expect(box.getAttribute("aria-invalid")).toBe("true");
    expect(description(box)).toBe("Please confirm | Needed to continue");
  });

  it("keeps its name, description, validity and visibility: outside aria attributes change nothing", () => {
    render(
      <>
        <span id="other">Something else</span>
        <Checkbox
          label="Include flaky tests"
          hint="Off by default"
          aria-label=""
          aria-labelledby="other"
          aria-describedby="other"
          aria-description="Injected"
          aria-errormessage="other"
          aria-invalid
          aria-hidden
          aria-checked="mixed"
          aria-required
          aria-disabled
          aria-readonly
        />
      </>,
    );
    const box = screen.getByRole("checkbox", { name: "Include flaky tests" });
    expect(description(box)).toBe("Off by default");
    // State comes only from checked, required and disabled.
    expect(box.getAttribute("aria-checked")).toBe("false");
    expect(box.getAttribute("aria-required")).not.toBe("true");
    for (const attribute of ["aria-disabled", "aria-readonly"]) {
      expect(box.getAttribute(attribute), attribute).toBeNull();
    }
    for (const attribute of [
      "aria-description",
      "aria-errormessage",
      "aria-invalid",
      "aria-hidden",
    ]) {
      expect(box.getAttribute(attribute), attribute).toBeNull();
    }
  });

  // One render each: TypeScript reports only the first unknown prop of a JSX element.
  it("does not accept hidden, inert, title or role", () => {
    // @ts-expect-error hidden would hide the box and leave its label on screen
    render(<Checkbox label="A" hidden />);
    // @ts-expect-error inert would remove it from focus and from the screen reader
    render(<Checkbox label="A" inert />);
    // @ts-expect-error title would become its description
    render(<Checkbox label="A" title="Injected" />);
    // @ts-expect-error role would change what it is announced as
    render(<Checkbox label="A" role="switch" />);
    for (const box of screen.getAllByRole("checkbox", { name: "A" })) {
      for (const attribute of ["hidden", "inert", "title"])
        expect(box.getAttribute(attribute)).toBeNull();
    }
  });

  it("gives every checkbox its own ids", () => {
    render(
      <>
        <Checkbox label="First" hint="One" />
        <Checkbox label="Second" hint="Two" />
      </>,
    );
    expect(description(screen.getByRole("checkbox", { name: "First" }))).toBe("One");
    expect(description(screen.getByRole("checkbox", { name: "Second" }))).toBe("Two");
  });
});

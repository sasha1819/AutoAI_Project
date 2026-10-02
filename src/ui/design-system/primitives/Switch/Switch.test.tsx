import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Switch } from "./Switch.tsx";

function description(element: HTMLElement): string {
  return (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter((id) => id !== "")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" | ");
}

describe("Switch", () => {
  it("is a switch named by its label, off by default", () => {
    render(<Switch label="Run on every pull request" />);
    const control = screen.getByRole("switch", { name: "Run on every pull request" });
    expect(control.getAttribute("aria-checked")).toBe("false");
  });

  // Checked at typecheck time (part of verify): each @ts-expect-error fails the build if the rule loosens.
  it("cannot be built without a name", () => {
    // @ts-expect-error no label: announced as just "switch"
    expect(() => render(<Switch />)).toThrow(/label/);
    // @ts-expect-error an empty label is no name either
    expect(() => render(<Switch label="" />)).toThrow(/label/);
    const fromData: string = " ";
    expect(() => render(<Switch label={fromData} />)).toThrow("Switch needs a non-empty label");
  });

  it("keyboard: Space and Enter both flip it (WAI-ARIA allows Enter for a switch; it is a button underneath)", async () => {
    const onCheckedChange = vi.fn();
    render(<Switch label="Notifications" onCheckedChange={onCheckedChange} />);
    const control = screen.getByRole("switch", { name: "Notifications" });
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(control);
    await user.keyboard(" ");
    expect(control.getAttribute("aria-checked")).toBe("true");
    await user.keyboard("{Enter}");
    expect(control.getAttribute("aria-checked")).toBe("false");
    expect(onCheckedChange.mock.calls).toStrictEqual([[true], [false]]);
  });

  it("pointer: clicking the switch or its label flips it", async () => {
    render(<Switch label="Notifications" />);
    const control = screen.getByRole("switch", { name: "Notifications" });
    const user = userEvent.setup();
    await user.click(control);
    expect(control.getAttribute("aria-checked")).toBe("true");
    await user.click(screen.getByText("Notifications"));
    expect(control.getAttribute("aria-checked")).toBe("false");
  });

  it("tab order follows the page and skips a disabled switch; disabled cannot be flipped and its label dims", async () => {
    const onCheckedChange = vi.fn();
    render(
      <>
        <Switch label="First" />
        <Switch label="Second" disabled defaultChecked onCheckedChange={onCheckedChange} />
        <Switch label="Third" />
      </>,
    );
    const user = userEvent.setup();
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("switch", { name: "Third" }));
    await user.click(screen.getByRole("switch", { name: "Second" }));
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(screen.getByText("Second").className).toContain("cursor-not-allowed");
  });

  it("works controlled", async () => {
    function Controlled() {
      const [on, setOn] = useState(true);
      return (
        <>
          <Switch label="Notifications" checked={on} onCheckedChange={setOn} />
          <output>{on ? "on" : "off"}</output>
        </>
      );
    }
    render(<Controlled />);
    await userEvent.setup().click(screen.getByRole("switch", { name: "Notifications" }));
    expect(screen.getByRole("status").textContent).toBe("off");
  });

  it("error: marked invalid, the error read before the hint", () => {
    render(<Switch label="Notifications" hint="Sent to your email" error="Add an email first" />);
    const control = screen.getByRole("switch", { name: "Notifications" });
    expect(control.getAttribute("aria-invalid")).toBe("true");
    expect(description(control)).toBe("Add an email first | Sent to your email");
  });

  it("keeps its name, description, state and visibility: outside aria attributes change nothing", () => {
    render(
      <>
        <span id="other">Something else</span>
        <Switch
          label="Notifications"
          hint="Off by default"
          aria-label=""
          aria-labelledby="other"
          aria-describedby="other"
          aria-description="Injected"
          aria-errormessage="other"
          aria-invalid
          aria-hidden
          aria-checked
          aria-disabled
          aria-readonly
        />
      </>,
    );
    const control = screen.getByRole("switch", { name: "Notifications" });
    expect(description(control)).toBe("Off by default");
    expect(control.getAttribute("aria-checked")).toBe("false");
    for (const attribute of [
      "aria-description",
      "aria-errormessage",
      "aria-invalid",
      "aria-hidden",
      "aria-disabled",
      "aria-readonly",
    ]) {
      expect(control.getAttribute(attribute), attribute).toBeNull();
    }
  });

  // One render each: TypeScript reports only the first unknown prop of a JSX element.
  it("does not accept hidden, inert, title or role", () => {
    // @ts-expect-error hidden would hide it and leave its label on screen
    render(<Switch label="A" hidden />);
    // @ts-expect-error inert would remove it from focus and from the screen reader
    render(<Switch label="A" inert />);
    // @ts-expect-error title would become its description
    render(<Switch label="A" title="Injected" />);
    // @ts-expect-error role would change what it is announced as
    render(<Switch label="A" role="checkbox" />);
    for (const control of screen.getAllByRole("switch", { name: "A" })) {
      for (const attribute of ["hidden", "inert", "title"])
        expect(control.getAttribute(attribute)).toBeNull();
    }
  });

  it("keeps its name with a visually hidden label (e.g. in a list row whose title says what it is)", () => {
    render(<Switch label="Nightly run" hideLabel />);
    expect(screen.getByRole("switch", { name: "Nightly run" })).toBeDefined();
  });
});

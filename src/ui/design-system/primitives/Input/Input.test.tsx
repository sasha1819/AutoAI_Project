import { Search } from "lucide-react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Input } from "./Input.tsx";

/** The text of the elements an input's aria-describedby points at, in order. */
function description(input: HTMLElement): string {
  return (input.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter((id) => id !== "")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" | ");
}

describe("Input", () => {
  it("is a text field named by its visible label", () => {
    render(<Input label="Repository folder" placeholder="/path/to/repo" />);
    const input = screen.getByRole("textbox", { name: "Repository folder" });
    expect(input.getAttribute("placeholder")).toBe("/path/to/repo");
    expect(screen.getByText("Repository folder").tagName).toBe("LABEL");
  });

  it("can hide its label visually and still be named by it (e.g. a search box)", () => {
    render(<Input label="Search" hideLabel type="search" />);
    expect(screen.getByRole("searchbox", { name: "Search" })).toBeDefined();
    expect(screen.getByText("Search").className).toContain("sr-only");
  });

  // Checked at typecheck time (part of verify): each @ts-expect-error fails the build if the rule loosens.
  it("cannot be built without a name", () => {
    // @ts-expect-error a field with no label is announced as just "edit text"
    expect(() => render(<Input />)).toThrow(/label/);
    // @ts-expect-error an empty label is no name either
    expect(() => render(<Input label="" />)).toThrow(/label/);
    const fromData: string = "  ";
    expect(() => render(<Input label={fromData} />)).toThrow("Input needs a non-empty label");
  });

  it("keeps its name, description, validity and role: outside aria attributes cannot change them", () => {
    render(
      <>
        <span id="other">Something else</span>
        <Input
          label="Repository folder"
          hint="Any local folder"
          aria-label=""
          aria-labelledby="other"
          aria-describedby="other"
          aria-invalid
          aria-hidden
        />
      </>,
    );
    const input = screen.getByRole("textbox", { name: "Repository folder" });
    expect(description(input)).toBe("Any local folder");
    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect(input.getAttribute("aria-hidden")).toBeNull();
  });

  it("cannot be hidden, described or re-stated from outside (hidden, inert, title, aria-description, …)", () => {
    render(
      <>
        <span id="other">Something else</span>
        <Input
          label="Repository folder"
          aria-description="Injected description"
          aria-errormessage="other"
          aria-readonly
          aria-disabled
          aria-required
        />
      </>,
    );
    const input = screen.getByRole("textbox", { name: "Repository folder" });
    for (const attribute of [
      "aria-description",
      "aria-errormessage",
      "aria-readonly",
      "aria-disabled",
      "aria-required",
    ]) {
      expect(input.getAttribute(attribute), attribute).toBeNull();
    }
  });

  // Checked at typecheck time (part of verify). One render each: TypeScript reports only the first unknown prop
  // of a JSX element, so each needs its own line.
  it("does not accept hidden, inert or title", () => {
    // @ts-expect-error hidden would hide the field and leave its label on screen
    render(<Input label="Repository folder" hidden />);
    // @ts-expect-error inert would remove the field from focus and from the screen reader
    render(<Input label="Repository folder" inert />);
    // @ts-expect-error title would become the field's description
    render(<Input label="Repository folder" title="Injected title" />);
  });

  it.each(["hidden", "inert", "title"])("drops %s if it is forced in anyway", (attribute) => {
    const forced = { [attribute]: attribute === "title" ? "Injected title" : true };
    render(<Input label="Repository folder" {...forced} />);
    expect(screen.getByLabelText("Repository folder").getAttribute(attribute)).toBeNull();
  });

  it("treats a hint or error of invisible characters as none", () => {
    render(<Input label="Name" hint={"\u200B"} error={"\uFEFF"} />);
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input.getAttribute("aria-describedby")).toBeNull();
    expect(input.getAttribute("aria-invalid")).toBeNull();
  });

  it("works controlled: typing reports each change", async () => {
    const onChange = vi.fn();
    function Controlled() {
      const [value, setValue] = useState("");
      return (
        <Input
          label="Name"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onChange(e.target.value);
          }}
        />
      );
    }
    render(<Controlled />);
    await userEvent.setup().type(screen.getByRole("textbox", { name: "Name" }), "abc");
    expect(onChange).toHaveBeenLastCalledWith("abc");
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty("value", "abc");
  });

  it("describes itself with its hint", () => {
    render(<Input label="API key" hint="Stored in your system keychain" />);
    expect(description(screen.getByRole("textbox", { name: "API key" }))).toBe(
      "Stored in your system keychain",
    );
  });

  it("error: marked invalid, and the error is read before the hint", () => {
    render(<Input label="API key" hint="Starts with sk-ant-" error="This key was rejected" />);
    const input = screen.getByRole("textbox", { name: "API key" });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(description(input)).toBe("This key was rejected | Starts with sk-ant-");
  });

  it("a blank error is no error", () => {
    render(<Input label="Name" error="  " />);
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect(input.getAttribute("aria-describedby")).toBeNull();
  });

  it("disabled: cannot be focused or typed in", async () => {
    render(<Input label="Name" disabled defaultValue="x" />);
    const input = screen.getByRole("textbox", { name: "Name" });
    const user = userEvent.setup();
    await user.tab();
    await user.type(input, "y");
    expect(document.activeElement).toBe(document.body);
    expect(input).toHaveProperty("value", "x");
  });

  it("read-only: can be focused and selected, but not changed", async () => {
    render(<Input label="Repository folder" readOnly defaultValue="/repo" />);
    const input = screen.getByRole("textbox", { name: "Repository folder" });
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(input);
    await user.keyboard("x");
    expect(input).toHaveProperty("value", "/repo");
  });

  it("a password field keeps its value hidden and is still named", () => {
    render(<Input label="API key" type="password" defaultValue="secret" />);
    const input = screen.getByLabelText("API key");
    expect(input.getAttribute("type")).toBe("password");
  });

  it("shows a decorative leading icon that screen readers skip", () => {
    const { container } = render(<Input label="Search" icon={Search} />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("gives every field its own ids, so two on a page never share a label or message", () => {
    render(
      <>
        <Input label="First" hint="One" />
        <Input label="Second" hint="Two" />
      </>,
    );
    expect(description(screen.getByRole("textbox", { name: "First" }))).toBe("One");
    expect(description(screen.getByRole("textbox", { name: "Second" }))).toBe("Two");
  });
});

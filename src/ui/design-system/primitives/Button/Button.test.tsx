import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button.tsx";

describe("Button", () => {
  it("is a button named by its label, and does not submit forms by default", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveProperty("type", "button");
  });

  it("can still be a submit button when asked", () => {
    render(<Button type="submit">Send</Button>);
    expect(screen.getByRole("button", { name: "Send" })).toHaveProperty("type", "submit");
  });

  it("runs onClick when clicked, and from the keyboard with Enter and Space", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Run</Button>);
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Run" }));
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    await user.click(screen.getByRole("button", { name: "Run" }));
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("disabled: cannot be clicked or focused", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Run
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Run" });
    const user = userEvent.setup();
    await user.click(button);
    await user.tab();
    expect(onClick).not.toHaveBeenCalled();
    expect(button).toHaveProperty("disabled", true);
    expect(document.activeElement).not.toBe(button);
  });

  it("loading: stays focusable and announced as busy, but ignores clicks and keys", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Scanning
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Scanning" });
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(button);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  it("shows its icons beside the label without changing its accessible name", () => {
    render(
      <Button icon={<svg data-testid="lead" />} trailingIcon={<svg data-testid="trail" />}>
        Continue
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Continue" })).toBeDefined();
    expect(screen.getByTestId("lead").parentElement?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByTestId("trail").parentElement?.getAttribute("aria-hidden")).toBe("true");
  });

  it("passes aria and data attributes through (e.g. aria-describedby)", () => {
    render(<Button aria-describedby="hint">Delete</Button>);
    expect(screen.getByRole("button", { name: "Delete" }).getAttribute("aria-describedby")).toBe(
      "hint",
    );
  });

  // Checked at typecheck time (part of verify): the @ts-expect-error fails the build if the rule ever loosens.
  it("cannot be built without a label (icon-only actions use IconButton)", () => {
    // @ts-expect-error an icon-only Button would have no accessible name
    render(<Button icon={<svg />} />);
  });

  it("ignores aria-disabled from outside: only loading makes it busy, so it is never announced disabled while acting", async () => {
    const onClick = vi.fn();
    render(
      <Button aria-disabled onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.getAttribute("aria-disabled")).toBeNull();
    await userEvent.setup().click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

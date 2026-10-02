import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SlidersHorizontal } from "lucide-react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../Button/index.ts";
import { IconButton } from "../IconButton/index.ts";
import { Popover } from "./Popover.tsx";

function Example({ onOpenChange }: { readonly onOpenChange?: (open: boolean) => void }) {
  return (
    <>
      <Popover
        label="Options"
        trigger={<Button variant="secondary">Open options</Button>}
        {...(onOpenChange === undefined ? {} : { onOpenChange })}
      >
        <button type="button">First choice</button>
        <button type="button">Second choice</button>
      </Popover>
      <button type="button">Outside</button>
    </>
  );
}

describe("Popover", () => {
  it("the trigger says it opens a dialog and whether it is open", async () => {
    const user = userEvent.setup();
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Open options" });
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("dialog", { name: "Options" })).toBeTruthy();
  });

  it("moves focus into the panel; Escape closes it and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Open options" });
    await user.click(trigger);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "First choice" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("opens from the keyboard too", async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: "Options" })).toBeTruthy();
  });

  it("closes on a click outside, and the page behind stays usable (not modal)", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn<(open: boolean) => void>();
    render(<Example onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole("button", { name: "Open options" }));
    expect(
      screen.getByRole("button", { name: "Outside" }).closest("[aria-hidden=true]"),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("Tab past the last control closes it and moves on to the control after the trigger", async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByRole("button", { name: "Open options" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Second choice" }));
    await user.tab();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Outside" }));
  });

  it("Shift+Tab before the first control closes it and returns to the trigger", async () => {
    const user = userEvent.setup();
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Open options" });
    await user.click(trigger);
    await user.tab({ shift: true });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("with nothing focusable inside, the panel itself takes focus (so it can scroll by keyboard)", async () => {
    const user = userEvent.setup();
    render(
      <Popover label="Details" trigger={<Button>Details</Button>}>
        <p>Only text</p>
      </Popover>,
    );
    await user.click(screen.getByRole("button", { name: "Details" }));
    expect(document.activeElement).toBe(screen.getByRole("dialog", { name: "Details" }));
  });

  it("an IconButton trigger keeps its name, tooltip and ref, and gets the popup state", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLButtonElement>();
    render(
      <Popover
        label="Filters"
        trigger={<IconButton ref={ref} label="Filter" icon={SlidersHorizontal} />}
      >
        <p>Panel</p>
      </Popover>,
    );
    const trigger = screen.getByRole("button", { name: "Filter" });
    expect(ref.current).toBe(trigger);
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    await user.hover(trigger);
    expect((await screen.findByText("Filter")).getAttribute("aria-hidden")).toBe("true");
    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("dialog", { name: "Filters" })).toBeTruthy();
  });

  it("controlled: shows what it is given", () => {
    const { rerender } = render(
      <Popover label="Options" trigger={<Button>Open</Button>} open={false}>
        <p>Panel</p>
      </Popover>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(
      <Popover label="Options" trigger={<Button>Open</Button>} open>
        <p>Panel</p>
      </Popover>,
    );
    expect(screen.getByRole("dialog", { name: "Options" })).toBeTruthy();
  });

  // The ts-expect-error lines are checked at typecheck time (part of verify); a blank name also throws at runtime.
  it("the panel must be named; closed props", () => {
    const blank: string = " ";
    expect(() =>
      render(
        <Popover label={blank} trigger={<Button>Open</Button>}>
          x
        </Popover>,
      ),
    ).toThrow("Popover needs a non-empty label");
    expect(() =>
      render(
        // @ts-expect-error a panel without a name
        <Popover trigger={<Button>Open</Button>}>x</Popover>,
      ),
    ).toThrow(/label/);
    render(
      // @ts-expect-error closed props: no className
      <Popover label="A" trigger={<Button>Open A</Button>} className="x">
        x
      </Popover>,
    );
    expect(screen.getByRole("button", { name: "Open A" })).toBeTruthy();
  });
});

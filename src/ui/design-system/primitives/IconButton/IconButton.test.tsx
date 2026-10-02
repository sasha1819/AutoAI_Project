import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IconButton } from "./IconButton.tsx";

const icon = <svg data-testid="icon" />;

describe("IconButton", () => {
  it("is a button named by its label (the icon itself is hidden from assistive tech)", () => {
    render(<IconButton label="Close" icon={icon} />);
    const button = screen.getByRole("button", { name: "Close" });
    expect(button.getAttribute("aria-label")).toBe("Close");
    expect(screen.getByTestId("icon").parentElement?.getAttribute("aria-hidden")).toBe("true");
    expect(button).toHaveProperty("type", "button");
  });

  // These are checked at typecheck time (part of verify): each @ts-expect-error fails the build if the rule loosens.
  it("cannot be built without an accessible name", () => {
    // @ts-expect-error no label: an icon-only button with no name is announced as just "button"
    expect(() => render(<IconButton icon={icon} />)).toThrow(/label/);
    // @ts-expect-error an empty label is no name either
    expect(() => render(<IconButton label="" icon={icon} />)).toThrow(/label/);
    // @ts-expect-error the icon is required too: it is the button's only visible content (a type check only)
    render(<IconButton label="Close" />);
  });

  it.each([
    ["spaces", "   "],
    ["a zero-width space", "\u200B"],
    ["a byte-order mark and a word joiner", "\uFEFF\u2060"],
    ["a soft hyphen and a vowel separator", "\u00AD\u180E"],
  ])(
    "refuses a label of only %s that reaches it at runtime (thrown, never rendered nameless)",
    (_name, blank) => {
      const fromData: string = blank;
      expect(() => render(<IconButton label={fromData} icon={icon} />)).toThrow(
        "IconButton needs a non-empty label",
      );
    },
  );

  it("keeps its name and role: outside aria-label, aria-labelledby, aria-hidden or role cannot change them", () => {
    render(
      <>
        <span id="other">Something else</span>
        <IconButton
          label="Close"
          icon={icon}
          aria-label=""
          aria-labelledby="other"
          aria-hidden
          // @ts-expect-error role is not accepted (unlike hyphenated attributes, it is type-checked)
          role="img"
        />
      </>,
    );
    const button = screen.getByRole("button", { name: "Close" });
    expect(button.getAttribute("aria-hidden")).toBeNull();
    expect(button.getAttribute("role")).toBeNull();
  });

  it("runs onClick from a click and from the keyboard", async () => {
    const onClick = vi.fn();
    render(<IconButton label="Send" icon={icon} onClick={onClick} />);
    const user = userEvent.setup();
    await user.tab();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("disabled: cannot be clicked or focused", async () => {
    const onClick = vi.fn();
    render(<IconButton label="Send" icon={icon} disabled onClick={onClick} />);
    const user = userEvent.setup();
    await user.tab();
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onClick).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);
  });

  it("loading: keeps its name, stays focusable, is announced busy, and ignores presses", async () => {
    const onClick = vi.fn();
    render(<IconButton label="Send" icon={icon} loading onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Send" });
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(button);
    await user.keyboard("{Enter}");
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(screen.queryByTestId("icon")).toBeNull();
  });
});

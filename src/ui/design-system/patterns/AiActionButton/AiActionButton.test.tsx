import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../../primitives/Button/index.ts";
import { AiActionButton } from "./AiActionButton.tsx";

const primaryLook = (): string => {
  const { container, unmount } = render(<Button>Look</Button>);
  const look = container.querySelector("button")?.className ?? "";
  unmount();
  return look;
};

describe("AiActionButton", () => {
  it("is a primary button named by its label, with the AI sparkle (decorative)", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<AiActionButton label="Explain this" onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Explain this" });
    expect(button.className).toBe(primaryLook());
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    await user.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("loading: busy, keeps its name, ignores presses", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<AiActionButton label="Explain this" onClick={onClick} loading />);
    const button = screen.getByRole("button", { name: "Explain this" });
    expect(button.getAttribute("aria-busy")).toBe("true");
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  // The ts-expect-error lines are checked at typecheck time (part of verify); a blank label also throws at runtime.
  it("must be named; always the AI look", () => {
    const blank: string = " ";
    expect(() => render(<AiActionButton label={blank} onClick={vi.fn()} />)).toThrow(
      "AiActionButton needs a non-empty label",
    );
    // @ts-expect-error the look is fixed: no variant
    render(<AiActionButton label="A" onClick={vi.fn()} variant="ghost" />);
    // @ts-expect-error the icon is fixed: the sparkle
    render(<AiActionButton label="B" onClick={vi.fn()} icon={null} />);
    expect(screen.getByRole("button", { name: "A" }).className).toBe(primaryLook());
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LinkButton } from "./LinkButton.tsx";

describe("LinkButton", () => {
  it("is a button (it never navigates), named by its words, that runs its action by click or keyboard", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<LinkButton onClick={onClick}>Read more</LinkButton>);
    const button = screen.getByRole("button", { name: "Read more" });
    expect(button.getAttribute("type")).toBe("button");
    await user.click(button);
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("external: says it opens in the browser, with a decorative icon", () => {
    const { container } = render(
      <LinkButton external onClick={vi.fn()}>
        Open the console
      </LinkButton>,
    );
    expect(
      screen.getByRole("button", { name: "Open the console (opens in your browser)" }),
    ).toBeTruthy();
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  // Checked at typecheck time (part of verify); blank words also throw at runtime.
  it("must have words", () => {
    const blank: string = " ";
    expect(() => render(<LinkButton onClick={vi.fn()}>{blank}</LinkButton>)).toThrow(
      "LinkButton needs a non-empty label",
    );
    // @ts-expect-error a link with no words
    expect(() => render(<LinkButton onClick={vi.fn()} />)).toThrow(/label/);
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AiChip, AiMark } from "./AiChip.tsx";

describe("AiChip", () => {
  it("says what Claude did in words; the sparkle is decorative; not a control", () => {
    const { container } = render(<AiChip label="Found by Claude" />);
    expect(screen.getByText("Found by Claude")).toBeTruthy();
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("a long label truncates instead of breaking the row", () => {
    render(<AiChip label="A long description of what Claude found in this project" />);
    expect(
      screen.getByText("A long description of what Claude found in this project").className,
    ).toContain("truncate");
  });

  // The ts-expect-error lines are checked at typecheck time (part of verify); a blank label also throws at runtime.
  it("must say it in words; closed props", () => {
    const blank: string = " ";
    expect(() => render(<AiChip label={blank} />)).toThrow("AiChip needs a non-empty label");
    // @ts-expect-error a chip without words
    expect(() => render(<AiChip />)).toThrow(/label/);
    // @ts-expect-error not a control: no onClick
    render(<AiChip label="A" onClick={() => undefined} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("AiMark", () => {
  it("decorative next to a heading: hidden from assistive tech", () => {
    const { container } = render(<AiMark decorative />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("on its own: an image named by its label", () => {
    render(<AiMark label="From Claude" />);
    expect(screen.getByRole("img", { name: "From Claude" })).toBeTruthy();
  });

  // Checked at typecheck time (part of verify).
  it("is labelled or decorative, never neither", () => {
    // @ts-expect-error neither a label nor decorative
    expect(() => render(<AiMark />)).toThrow(/label/);
    // @ts-expect-error both a label and decorative
    render(<AiMark decorative label="X" />);
  });
});

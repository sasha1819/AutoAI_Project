import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StepRow } from "./StepRow.tsx";

// What a screen reader gets: the text with hidden parts removed.
const spoken = (root: HTMLElement): string => {
  const clone = root.cloneNode(true);
  if (!(clone instanceof HTMLElement)) throw new Error("not an element");
  for (const hidden of clone.querySelectorAll("[aria-hidden=true]")) hidden.remove();
  return clone.textContent;
};

describe("StepRow", () => {
  it("reads name, status in words, then duration; the icon and dash are not read", () => {
    const { container } = render(<StepRow name="Open the app" status="passed" durationMs={1200} />);
    expect(spoken(container)).toBe("Open the app, passed, 1.2s");
  });

  it("a step that never ran is muted and shows a dash for its duration", () => {
    const { container, getByText } = render(<StepRow name="Go to checkout" status="not_run" />);
    expect(spoken(container)).toBe("Go to checkout, not run");
    expect(getByText("Go to checkout").className).toContain("text-text-muted");
    expect(container.textContent).toContain("–");
  });

  it("a long name truncates", () => {
    const { getByText } = render(
      <StepRow name="A very long step name that cannot fit" status="failed" durationMs={10_000} />,
    );
    expect(getByText("A very long step name that cannot fit").className).toContain("truncate");
  });

  // The ts-expect-error lines are checked at typecheck time (part of verify); a blank name also throws at runtime.
  it("must be named; a status, never a colour", () => {
    const blank: string = " ";
    expect(() => render(<StepRow name={blank} status="passed" />)).toThrow(
      "StepRow needs a non-empty label",
    );
    // @ts-expect-error screens never pick a colour
    render(<StepRow name="A" status="passed" tone="failed" />);
  });
});

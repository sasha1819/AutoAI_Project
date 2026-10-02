import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RequirementTag } from "./RequirementTag.tsx";

describe("RequirementTag", () => {
  it("says PRD and the tag, the tag in mono; the dot is not read", () => {
    const { container } = render(<RequirementTag tag="Area 1.2" />);
    expect(screen.getByText("Area 1.2").className).toContain("font-mono");
    expect(container.querySelector("[aria-hidden=true]")?.textContent).toBe("·");
    expect(container.textContent).toBe("PRD · Area 1.2");
  });

  it("is neutral text, not violet (closed to primary and AI uses)", () => {
    const { container } = render(<RequirementTag tag="Area 1.2" />);
    expect(container.innerHTML).not.toMatch(/accent|ai-/);
  });

  it("a long tag (a heading title) truncates instead of breaking the row", () => {
    render(<RequirementTag tag="A long heading title used as a tag" />);
    expect(screen.getByText("A long heading title used as a tag").className).toContain("truncate");
  });

  it("refuses a blank tag", () => {
    const fromData: string = " ";
    expect(() => render(<RequirementTag tag={fromData} />)).toThrow(
      "RequirementTag needs a non-empty label",
    );
  });
});

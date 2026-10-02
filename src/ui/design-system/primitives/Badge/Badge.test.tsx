import { Check } from "lucide-react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge.tsx";

describe("Badge", () => {
  it("is plain text, not a control", () => {
    render(<Badge label="Example" />);
    const badge = screen.getByText("Example");
    expect(badge.tagName).toBe("SPAN");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows a decorative icon that screen readers skip", () => {
    const { container } = render(<Badge label="Example" icon={Check} />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("can be caps (short tags)", () => {
    render(<Badge label="Area" uppercase />);
    expect(screen.getByText("Area").className).toContain("uppercase");
  });

  it("has the outlined area-tag look (mockup 11)", () => {
    render(<Badge label="Area" />);
    expect(screen.getByText("Area").className).toContain("border-border-default");
  });

  // The ts-expect-error lines are checked at typecheck time (part of verify); the blank labels also throw at runtime.
  it("cannot be blank, and screens cannot pick a colour", () => {
    // @ts-expect-error a badge without words
    expect(() => render(<Badge />)).toThrow(/label/);
    // @ts-expect-error an empty label
    expect(() => render(<Badge label="" />)).toThrow(/label/);
    // @ts-expect-error no tone: a status is a StatusPill, a severity a SeverityTag
    render(<Badge label="Failed" tone="failed" />);
    expect(screen.getByText("Failed").className).not.toMatch(/failed/);
  });
});

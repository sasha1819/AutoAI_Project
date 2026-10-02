import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Severity } from "../../../../core/domain/finding.ts";
import { type BadgeTone, ToneBadge } from "../../primitives/_badge/index.ts";
import { SeverityTag } from "./SeverityTag.tsx";

describe("SeverityTag", () => {
  it.each<[Severity, string, BadgeTone]>([
    ["high", "High", "failed"],
    ["medium", "Medium", "warning"],
    ["low", "Low", "neutral"],
  ])("%s: says %s in the %s tone, title case, no icon", (severity, word, tone) => {
    const { container } = render(<SeverityTag severity={severity} />);
    const { container: expected } = render(<ToneBadge label="x" tone={tone} />);
    expect(screen.getByText(word).className).toBe(expected.firstElementChild?.className);
    expect(container.querySelector("svg")).toBeNull();
  });

  // The ts-expect-error lines are checked at typecheck time (part of verify).
  it("takes a domain severity only", () => {
    const fromData: string = "critical";
    // @ts-expect-error unknown values are refused (and throw at runtime)
    expect(() => render(<SeverityTag severity={fromData} />)).toThrow(/unknown severity/);
    // @ts-expect-error screens never pick a colour
    render(<SeverityTag severity="low" tone="failed" />);
    expect(screen.getByText("Low").className).toBe(
      render(<ToneBadge label="y" tone="neutral" />).container.firstElementChild?.className,
    );
  });
});

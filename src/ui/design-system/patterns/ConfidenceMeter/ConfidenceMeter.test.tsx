import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Confidence } from "../../../../core/domain/finding.ts";
import { ConfidenceMeter } from "./ConfidenceMeter.tsx";

describe("ConfidenceMeter", () => {
  it.each([
    [0, "0"],
    [0.72, "72"],
    [1, "100"],
  ])("%s is read as a meter at %s%%", (value, percent) => {
    render(<ConfidenceMeter confidence={Confidence.parse(value)} />);
    const meter = screen.getByRole("meter", { name: "Confidence" });
    expect(meter.getAttribute("aria-valuenow")).toBe(percent);
    expect(meter.getAttribute("aria-valuetext")).toBe(`${percent}% confident`);
    expect(screen.getByText(`${percent}% confident`).getAttribute("aria-hidden")).toBe("true");
  });

  it("neutral: no status colour, no violet", () => {
    const { container } = render(<ConfidenceMeter confidence={Confidence.parse(0.3)} />);
    expect(container.innerHTML).not.toMatch(/status-|accent|ai-/);
  });

  // Checked at typecheck time (part of verify).
  it("takes the validated Confidence, not a raw number", () => {
    // @ts-expect-error a plain number has not passed the domain schema
    render(<ConfidenceMeter confidence={0.5} />);
  });
});

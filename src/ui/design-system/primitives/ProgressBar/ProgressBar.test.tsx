import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "./ProgressBar.tsx";

const fill = (bar: HTMLElement): HTMLElement => {
  const el = bar.firstElementChild;
  if (!(el instanceof HTMLElement)) throw new Error("no fill");
  return el;
};

describe("ProgressBar", () => {
  it("is a progressbar named by its label, with its value", () => {
    render(<ProgressBar label="Run progress" value={4} max={9} />);
    const bar = screen.getByRole("progressbar", { name: "Run progress" });
    expect(bar.getAttribute("aria-valuenow")).toBe("4");
    expect(bar.getAttribute("aria-valuemax")).toBe("9");
    expect(fill(bar).style.width).toBe(`${String((4 / 9) * 100)}%`);
  });

  it("reads the value in words once, and shows it", () => {
    render(<ProgressBar label="Run progress" value={4} max={9} valueText="4 of 9 done" />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuetext")).toBe("4 of 9 done");
    expect(screen.getByText("4 of 9 done").getAttribute("aria-hidden")).toBe("true");
  });

  it("ignores a blank value text", () => {
    render(<ProgressBar label="Run progress" value={1} valueText="  " />);
    expect(screen.getByRole("progressbar").hasAttribute("aria-valuetext")).toBe(false);
  });

  it("is indeterminate without a value: no valuenow, a sliding fill", () => {
    render(<ProgressBar label="Scanning" />);
    const bar = screen.getByRole("progressbar", { name: "Scanning" });
    expect(bar.hasAttribute("aria-valuenow")).toBe(false);
    expect(fill(bar).className).toContain("animate-progress-slide");
    expect(fill(bar).className).toContain("motion-reduce:animate-none");
    expect(bar.textContent).toBe("");
  });

  it.each([
    [-3, "0", "0%"],
    [12, "9", "100%"],
  ])("clamps %s into 0..max", (value, now, width) => {
    render(<ProgressBar label="Run progress" value={value} max={9} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe(now);
    expect(fill(bar).style.width).toBe(width);
  });

  it.each([
    [{ max: 0 }, /max must be a number above 0/],
    [{ max: Number.NaN }, /max must be a number above 0/],
    [{ value: Number.NaN }, /value must be a number/],
  ])("throws on a bug in its numbers (%o)", (numbers, message) => {
    expect(() => render(<ProgressBar label="Run progress" {...numbers} />)).toThrow(message);
  });

  it.each<[string, number, "passed" | "failed" | undefined, string]>([
    ["running, no outcome yet", 4, undefined, "bg-progress-active"],
    ["running with failures already known", 4, "failed", "bg-progress-active"],
    ["running, all passing so far", 4, "passed", "bg-progress-active"],
    ["complete, outcome not given", 9, undefined, "bg-progress-active"],
    ["complete and passed", 9, "passed", "bg-progress-passed"],
    ["complete with failures", 9, "failed", "bg-progress-failed"],
    ["past the total (clamped to complete) and passed", 12, "passed", "bg-progress-passed"],
  ])("colour shows the outcome, not just completion: %s", (_, value, outcome, tone) => {
    render(
      outcome === undefined ? (
        <ProgressBar label="Run progress" value={value} max={9} />
      ) : (
        <ProgressBar
          label="Run progress"
          value={value}
          max={9}
          outcome={outcome}
          valueText="words"
        />
      ),
    );
    const cls = fill(screen.getByRole("progressbar")).className;
    expect(cls).toContain(tone);
    for (const other of ["bg-progress-active", "bg-progress-passed", "bg-progress-failed"]) {
      if (other !== tone) expect(cls).not.toContain(other);
    }
  });

  it("an indeterminate bar ignores an outcome", () => {
    render(<ProgressBar label="Scanning" outcome="passed" valueText="Working" />);
    expect(fill(screen.getByRole("progressbar")).className).toContain("bg-progress-active");
  });

  it("an outcome must be said in words, not by colour alone", () => {
    // @ts-expect-error an outcome without valueText
    expect(() => render(<ProgressBar label="Run" value={9} max={9} outcome="failed" />)).toThrow(
      /needs valueText/,
    );
    expect(() =>
      render(<ProgressBar label="Run" value={9} max={9} outcome="failed" valueText="  " />),
    ).toThrow(/needs valueText/);
  });

  it("indeterminate is neutral, and stays still on a centred third with reduced motion", () => {
    render(<ProgressBar label="Scanning" />);
    const busy = fill(screen.getByRole("progressbar")).className;
    expect(busy).toContain("bg-progress-active");
    expect(busy).toContain("motion-reduce:left-1/3");
  });

  // The ts-expect-error lines are checked at typecheck time (part of verify); blank labels also throw at runtime.
  it("cannot be unnamed, and takes no outside aria or style", () => {
    const fromData: string = " ";
    expect(() => render(<ProgressBar label={fromData} value={1} />)).toThrow(
      "ProgressBar needs a non-empty label",
    );
    // @ts-expect-error a bar without a name
    expect(() => render(<ProgressBar value={1} />)).toThrow(/label/);
    // @ts-expect-error an empty label
    expect(() => render(<ProgressBar label="" value={1} />)).toThrow(/label/);
    // @ts-expect-error closed props: no className
    render(<ProgressBar label="A" value={1} className="x" />);
    // @ts-expect-error closed props: no role
    render(<ProgressBar label="B" value={1} role="img" />);
    expect(screen.getAllByRole("progressbar")).toHaveLength(2);
  });
});

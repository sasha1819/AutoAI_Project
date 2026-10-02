import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RunLog, RunLogLine } from "./RunLogLine.tsx";

const spoken = (root: HTMLElement): string => {
  const clone = root.cloneNode(true);
  if (!(clone instanceof HTMLElement)) throw new Error("not an element");
  for (const hidden of clone.querySelectorAll("[aria-hidden=true]")) hidden.remove();
  return clone.textContent;
};

describe("RunLog and RunLogLine", () => {
  it("is a named log region that announces added lines, in an ordered list", () => {
    render(
      <RunLog label="Run log">
        <RunLogLine atMs={0} status="passed" text="Opened the app" durationMs={1200} />
      </RunLog>,
    );
    const log = screen.getByRole("log", { name: "Run log" });
    expect(log.getAttribute("aria-relevant")).toBe("additions");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("a line reads time, text, status in words, duration", () => {
    render(
      <RunLog label="Run log">
        <RunLogLine atMs={1200} status="passed" text="Logged in" durationMs={3400} />
      </RunLog>,
    );
    expect(spoken(screen.getByRole("listitem"))).toBe("00:01.2, Logged in, passed, 3.4s");
  });

  it("the current line is highlighted and marked as the current step; its duration is pending", () => {
    render(
      <RunLog label="Run log">
        <RunLogLine atMs={6500} status="running" text="Adding to cart" current />
      </RunLog>,
    );
    const line = screen.getByRole("listitem");
    expect(line.getAttribute("aria-current")).toBe("step");
    expect(line.className).toContain("bg-selected");
    expect(line.textContent).toContain("…");
  });

  it("a line enters the log when the run reaches it, so it is announced once; upcoming lines are outside it", () => {
    const { rerender } = render(
      <RunLog label="Run log">
        <RunLogLine key="1" atMs={0} status="passed" text="First" durationMs={1000} />
        <RunLogLine key="2" status="not_run" text="Second" />
      </RunLog>,
    );
    const log = screen.getByRole("log", { name: "Run log" });
    expect(log.textContent).toContain("First");
    expect(log.textContent).not.toContain("Second");
    rerender(
      <RunLog label="Run log">
        <RunLogLine key="1" atMs={0} status="passed" text="First" durationMs={1000} />
        <RunLogLine key="2" atMs={1000} status="running" text="Second" current />
      </RunLog>,
    );
    expect(screen.getByRole("log").textContent).toContain("Second");
  });

  it("refuses an upcoming line before a reached one (it would move on screen)", () => {
    expect(() =>
      render(
        <RunLog label="Run log">
          <RunLogLine status="not_run" text="Later" />
          <RunLogLine atMs={0} status="passed" text="Done" />
        </RunLog>,
      ),
    ).toThrow(/upcoming lines go last/);
  });

  it("refuses an empty log", () => {
    expect(() => render(<RunLog label="Run log">{[]}</RunLog>)).toThrow(/at least one line/);
  });

  it("a line not reached yet is muted, with dashes for time and duration", () => {
    render(
      <RunLog label="Run log">
        <RunLogLine status="not_run" text="Check the order" />
      </RunLog>,
    );
    expect(screen.getByText("Check the order").className).toContain("text-text-muted");
    expect(spoken(screen.getByRole("listitem"))).toBe("Check the order, not run");
  });

  // The ts-expect-error lines are checked at typecheck time (part of verify); blank values also throw at runtime.
  it("lines and log must say something", () => {
    const blank: string = " ";
    expect(() =>
      render(
        <RunLog label="Run log">
          <RunLogLine atMs={0} status="passed" text={blank} />
        </RunLog>,
      ),
    ).toThrow("RunLogLine needs a non-empty label");
    expect(() =>
      render(
        // @ts-expect-error an unnamed log
        <RunLog>
          <RunLogLine atMs={0} status="passed" text="A" />
        </RunLog>,
      ),
    ).toThrow(/label/);
    render(
      <RunLog label="X">
        {/* @ts-expect-error a line not reached has no time */}
        <RunLogLine status="not_run" atMs={5} text="B" />
      </RunLog>,
    );
    render(
      <RunLog label="Y">
        {/* @ts-expect-error only a running line can be current */}
        <RunLogLine status="failed" atMs={5} text="C" current />
      </RunLog>,
    );
  });
});

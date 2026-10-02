import { render, screen } from "@testing-library/react";
import { List } from "lucide-react";
import { describe, expect, it } from "vitest";
import { Button } from "../Button/index.ts";
import { EmptyState } from "./EmptyState.tsx";

describe("EmptyState", () => {
  it("page: the title is a heading, the icon is decorative, the actions follow", () => {
    const { container } = render(
      <EmptyState
        title="Nothing yet"
        description="How to start"
        icon={List}
        actions={<Button>Start</Button>}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Nothing yet" })).toBeTruthy();
    expect(screen.getByText("How to start")).toBeTruthy();
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
  });

  it("the heading level fits the page outline", () => {
    render(<EmptyState title="Nothing yet" headingLevel={3} />);
    expect(screen.getByRole("heading", { level: 3 })).toBeTruthy();
  });

  it("is not a live region: it is content, not news", () => {
    const { container } = render(<EmptyState title="Nothing yet" />);
    expect(container.querySelector("[aria-live],[role=status],[role=alert]")).toBeNull();
  });

  it("leaves out a blank description, and the tile without an icon", () => {
    const { container } = render(<EmptyState title="Nothing yet" description="  " />);
    expect(container.querySelectorAll("p")).toHaveLength(0);
    expect(container.querySelector(".rounded-tile")).toBeNull();
  });

  it("compact: one muted line, no heading", () => {
    render(<EmptyState size="compact" title="Nothing here yet" />);
    const line = screen.getByText("Nothing here yet");
    expect(line.tagName).toBe("P");
    expect(line.className).toContain("text-text-muted");
    expect(screen.queryByRole("heading")).toBeNull();
  });

  // The ts-expect-error lines are checked at typecheck time (part of verify); a blank title also throws at runtime.
  it("always says what is missing; compact takes only a title", () => {
    const fromData: string = "​";
    expect(() => render(<EmptyState title={fromData} />)).toThrow(
      "EmptyState needs a non-empty label",
    );
    // @ts-expect-error an empty state with no title
    expect(() => render(<EmptyState description="x" />)).toThrow(/label/);
    // @ts-expect-error compact has no icon or actions
    render(<EmptyState size="compact" title="Nothing" icon={List} />);
    // @ts-expect-error heading levels 2-4 only (and a value from untyped data throws)
    expect(() => render(<EmptyState title="Nothing" headingLevel={1} />)).toThrow(
      /must be 2, 3 or 4/,
    );
    // @ts-expect-error actions are an element: `cond && <Button/>` (false) would leave stray space
    render(<EmptyState title="Nothing" actions={false} />);
    // @ts-expect-error closed props: no className
    render(<EmptyState title="Nothing" className="x" />);
    expect(screen.getAllByText("Nothing").length).toBeGreaterThan(0);
  });
});

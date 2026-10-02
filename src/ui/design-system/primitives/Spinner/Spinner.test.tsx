import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Spinner } from "./Spinner.tsx";

describe("Spinner", () => {
  it("announces what is loading: a status named by its label, the label hidden visually", () => {
    render(<Spinner label="Loading results" />);
    const status = screen.getByRole("status", { name: "Loading results" });
    expect(status.textContent).toBe("Loading results");
    expect(screen.getByText("Loading results").className).toContain("sr-only");
  });

  it("decorative (inside a control that is already marked busy): hidden from assistive tech, no status", () => {
    const { container } = render(<Spinner decorative />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  // Checked at typecheck time (part of verify).
  it("must either say what is loading or be decorative", () => {
    // @ts-expect-error neither a label nor decorative: a spinner nobody can identify
    expect(() => render(<Spinner />)).toThrow(/label/);
    // @ts-expect-error an empty label says nothing
    expect(() => render(<Spinner label="" />)).toThrow(/label/);
    // @ts-expect-error decorative with a label is contradictory (forced anyway, it stays decorative)
    render(<Spinner decorative label="Loading" />);
    expect(screen.queryByRole("status")).toBeNull();
    const fromData: string = "​";
    expect(() => render(<Spinner label={fromData} />)).toThrow("Spinner needs a non-empty label");
  });

  it("stops spinning for people who ask for reduced motion", () => {
    const { container } = render(<Spinner decorative />);
    expect(container.querySelector("svg")?.getAttribute("class")).toContain(
      "motion-reduce:animate-none",
    );
  });
});

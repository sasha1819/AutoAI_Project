import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "../../primitives/Button/index.ts";
import { FindingCard } from "./FindingCard.tsx";
import { exampleFinding } from "./finding-fixture.ts";

describe("FindingCard", () => {
  it("is an article named by its area and requirement heading", () => {
    render(<FindingCard finding={exampleFinding()} />);
    const card = screen.getByRole("article", { name: /^Area PRD\s+Area 1\.2$/ });
    expect(within(card).getByRole("heading", { level: 3 })).toBeTruthy();
  });

  it("shows what the PRD says next to what the code does, the evidence file and the severity", () => {
    render(<FindingCard finding={exampleFinding()} />);
    expect(screen.getByText("What the PRD says")).toBeTruthy();
    expect(screen.getByText("What the code actually does")).toBeTruthy();
    expect(screen.getByText(/What the requirement says/)).toBeTruthy();
    expect(screen.getByText(/What the code does instead/)).toBeTruthy();
    expect(screen.getByText("High")).toBeTruthy();
    expect(screen.getByText("Found while scanning src/example/file.ts")).toBeTruthy();
    expect(screen.getByRole("meter", { name: "Confidence" }).getAttribute("aria-valuenow")).toBe(
      "86",
    );
  });

  it("no severity: nothing is shown in its place", () => {
    render(<FindingCard finding={exampleFinding({ severity: null })} />);
    for (const word of ["High", "Medium", "Low", "Unrated"])
      expect(screen.queryByText(word)).toBeNull();
  });

  it("needs review: never stated as fact — tagged, hedged, and the reasons in words", () => {
    render(
      <FindingCard
        finding={exampleFinding({
          confidence: 0.55,
          reviewStatus: "needs_review",
          reviewReasons: ["LOW_CONFIDENCE", "UNVERIFIED_EVIDENCE"],
        })}
      />,
    );
    expect(screen.getByText("Needs review")).toBeTruthy();
    expect(screen.queryByText("What the code actually does")).toBeNull();
    expect(screen.getByText("What the code may do")).toBeTruthy();
    expect(screen.getByText("Claude is not sure about this one.")).toBeTruthy();
    expect(screen.getByText("The quoted code was not found in the file.")).toBeTruthy();
  });

  it("a confirmed finding has no review tag or reasons", () => {
    render(<FindingCard finding={exampleFinding()} />);
    expect(screen.queryByText("Needs review")).toBeNull();
  });

  it.each([
    ["not_implemented", "Not implemented", "In the code"],
    ["match", "Matches", "What the code does"],
  ])("a %s finding says so", (type, kind, label) => {
    render(
      <FindingCard
        finding={exampleFinding({ type, severity: type === "match" ? null : "medium" })}
      />,
    );
    expect(screen.getByText(kind)).toBeTruthy();
    expect(screen.getByText(label)).toBeTruthy();
  });

  it("without evidence: no file and no 'found while scanning'", () => {
    render(<FindingCard finding={exampleFinding({ type: "not_implemented", evidence: null })} />);
    expect(screen.queryByText(/Found while scanning/)).toBeNull();
  });

  it("the evidence file says its lines to screen readers", () => {
    render(<FindingCard finding={exampleFinding()} />);
    expect(screen.getByText(", lines 12 to 18")).toBeTruthy();
  });

  it("shows the screen's actions", () => {
    render(
      <FindingCard finding={exampleFinding()} actions={<Button variant="secondary">Act</Button>} />,
    );
    expect(screen.getByRole("button", { name: "Act" })).toBeTruthy();
  });

  it("heading level fits the outline; other levels are refused", () => {
    render(<FindingCard finding={exampleFinding()} headingLevel={2} />);
    expect(screen.getByRole("heading", { level: 2 })).toBeTruthy();
    // @ts-expect-error heading levels 2-4 only (and a value from untyped data throws)
    expect(() => render(<FindingCard finding={exampleFinding()} headingLevel={5} />)).toThrow(
      /must be 2, 3 or 4/,
    );
  });
});

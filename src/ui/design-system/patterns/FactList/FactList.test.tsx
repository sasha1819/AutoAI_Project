import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FactList } from "./FactList.tsx";

describe("FactList", () => {
  it("is a description list: each value read with its label", () => {
    const { container } = render(
      <FactList
        facts={[
          { label: "Element", value: "#example", mono: true },
          { label: "Waited", value: "10.0s" },
        ]}
      />,
    );
    expect(container.querySelector("dl")).not.toBeNull();
    expect([...container.querySelectorAll("dt")].map((d) => d.textContent)).toEqual([
      "Element",
      "Waited",
    ]);
    expect(screen.getByText("#example").className).toContain("font-mono");
    expect(screen.getByText("10.0s").className).not.toContain("font-mono");
  });

  it.each([
    ["no facts", [], /at least one fact/],
    ["a blank label", [{ label: " ", value: "x" }], /non-blank label/],
    [
      "a repeated label",
      [
        { label: "Step", value: "a" },
        { label: "step", value: "b" },
      ],
      /used twice/,
    ],
  ])("refuses %s", (_name, facts, message) => {
    expect(() => render(<FactList facts={facts} />)).toThrow(message);
  });
});

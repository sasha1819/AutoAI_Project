import { describe, expect, it } from "vitest";
import { formatRequirements } from "./format-requirements.ts";

const req = (tag: string, area: string, text: string, file: string, line: number) => ({
  tag,
  area,
  text,
  source: { file, line },
});

describe("formatRequirements", () => {
  it("groups by area in order of first appearance and shows where each came from", () => {
    const out = formatRequirements("docs/prds", {
      prdFiles: ["cart.md", "checkout.md"],
      requirements: [
        req("Cart 2.4", "Cart", "Codes are case-insensitive.", "cart.md", 1),
        req("Checkout 1.1", "Checkout", "Guests can pay.\nCard only.", "checkout.md", 3),
        req("Cart 2.5", "Cart", "Totals update live.", "cart.md", 4),
      ],
    });
    expect(out).toBe(
      [
        "Found 3 requirements in 2 PRD files (docs/prds)",
        "",
        "Cart",
        "  Cart 2.4  Codes are case-insensitive.  (cart.md:1)",
        "  Cart 2.5  Totals update live.  (cart.md:4)",
        "",
        "Checkout",
        "  Checkout 1.1  Guests can pay. …  (checkout.md:3)",
      ].join("\n"),
    );
  });

  it("names PRD files that produced no requirements", () => {
    const out = formatRequirements("p", {
      prdFiles: ["a.md", "notes.txt", "z.md"],
      requirements: [req("Cart 1.1", "Cart", "A.", "a.md", 1)],
    });
    expect(out.split("\n").slice(-2)).toStrictEqual([
      "",
      "No requirements found in: notes.txt, z.md",
    ]);
  });

  it("cuts a long first line at 100 characters", () => {
    const long = `${"word ".repeat(30)}end`;
    const out = formatRequirements("p", {
      prdFiles: ["a.md"],
      requirements: [req("Cart 1.1", "Cart", long, "a.md", 1)],
    });
    expect(out.split("\n")[3]).toBe(`  Cart 1.1  ${long.slice(0, 99)}…  (a.md:1)`);
  });

  it("uses singular words for one requirement in one file", () => {
    const out = formatRequirements("p", {
      prdFiles: ["a.md"],
      requirements: [req("Cart 1.1", "Cart", "A.", "a.md", 1)],
    });
    expect(out.split("\n")[0]).toBe("Found 1 requirement in 1 PRD file (p)");
  });

  it("explains what the parser looks for when nothing was found", () => {
    const out = formatRequirements("p", { prdFiles: ["a.md", "b.txt"], requirements: [] });
    expect(out).toBe(
      [
        "Found 0 requirements in 2 PRD files (p)",
        "",
        'No tagged items (like "Area 1.2: ...") or headings with text under them were found.',
      ].join("\n"),
    );
  });
});

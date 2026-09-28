import { describe, expect, it } from "vitest";
import { parsePrd } from "./prd.ts";

type Row = { tag: string; area: string; text: string; line: number };
const FILE = "prds/shop.md";
const req = ({ tag, area, text, line }: Row) => ({ tag, area, text, source: { file: FILE, line } });
const lines = (...l: string[]) => l.join("\n");

describe("parsePrd — tagged items", () => {
  it.each<[string, string, Row[]]>([
    [
      "colon separator",
      "Cart 2.4: Discount codes are case-insensitive.",
      [{ tag: "Cart 2.4", area: "Cart", text: "Discount codes are case-insensitive.", line: 1 }],
    ],
    [
      "multi-word area, dash separator",
      "Checkout Flow 3.1 - Guests can check out",
      [{ tag: "Checkout Flow 3.1", area: "Checkout Flow", text: "Guests can check out", line: 1 }],
    ],
    [
      "hyphenated area",
      "Sign-Up 1.2: Email is required",
      [{ tag: "Sign-Up 1.2", area: "Sign-Up", text: "Email is required", line: 1 }],
    ],
    [
      "bullet with bold tag and em dash",
      "- **Cart 2.5** — Total updates live",
      [{ tag: "Cart 2.5", area: "Cart", text: "Total updates live", line: 1 }],
    ],
    [
      "ordered list item",
      "1. Cart 2.6) Empty cart shows a hint",
      [{ tag: "Cart 2.6", area: "Cart", text: "Empty cart shows a hint", line: 1 }],
    ],
    [
      "single number needs a colon",
      "Checkout 3: Pay by card",
      [{ tag: "Checkout 3", area: "Checkout", text: "Pay by card", line: 1 }],
    ],
    [
      "continuation lines join into one sentence",
      lines("Cart 2.4: Codes are case-insensitive.", "They expire after 30 days."),
      [
        {
          tag: "Cart 2.4",
          area: "Cart",
          text: "Codes are case-insensitive. They expire after 30 days.",
          line: 1,
        },
      ],
    ],
    [
      "a tagged item's own bullets stay on separate lines",
      lines("Cart 2.4: Codes:", "- are case-insensitive", "- expire after 30 days"),
      [
        {
          tag: "Cart 2.4",
          area: "Cart",
          text: "Codes:\n- are case-insensitive\n- expire after 30 days",
          line: 1,
        },
      ],
    ],
    [
      "a blank line ends a line-started item",
      lines("Cart 2.4: A.", "", "General note."),
      [{ tag: "Cart 2.4", area: "Cart", text: "A.", line: 1 }],
    ],
    [
      "a heading-started item keeps its paragraphs",
      lines(
        "### Cart 2.4 — Discounts",
        "",
        "Case-insensitive.",
        "",
        "One per order.",
        "### Cart 2.5: Totals",
        "Live.",
      ),
      [
        {
          tag: "Cart 2.4",
          area: "Cart",
          text: "Discounts\nCase-insensitive.\nOne per order.",
          line: 1,
        },
        { tag: "Cart 2.5", area: "Cart", text: "Totals\nLive.", line: 6 },
      ],
    ],
    [
      "heading tag without title uses the body",
      lines("## Cart 2.4", "Codes are case-insensitive."),
      [{ tag: "Cart 2.4", area: "Cart", text: "Codes are case-insensitive.", line: 1 }],
    ],
    [
      "untagged headings and prose are ignored once tags exist",
      lines("## Cart", "Intro text.", "", "Cart 2.4: A"),
      [{ tag: "Cart 2.4", area: "Cart", text: "A", line: 4 }],
    ],
    [
      "an untagged heading ends the previous item",
      lines("### Cart 2.4 — A", "Body.", "## Checkout", "Not part of 2.4."),
      [{ tag: "Cart 2.4", area: "Cart", text: "A\nBody.", line: 1 }],
    ],
    [
      "a new tag ends the previous item",
      lines("Cart 2.4: A", "Cart 2.5: B"),
      [
        { tag: "Cart 2.4", area: "Cart", text: "A", line: 1 },
        { tag: "Cart 2.5", area: "Cart", text: "B", line: 2 },
      ],
    ],
    [
      "a tag with no text is skipped",
      lines("Cart 2.4:", "", "Cart 2.5: B"),
      [{ tag: "Cart 2.5", area: "Cart", text: "B", line: 3 }],
    ],
    [
      "whitespace is collapsed",
      "Cart 2.4:   A    b\t c",
      [{ tag: "Cart 2.4", area: "Cart", text: "A b c", line: 1 }],
    ],
    [
      "duplicate tags are kept in order",
      lines("Cart 2.4: A", "", "Cart 2.4: B"),
      [
        { tag: "Cart 2.4", area: "Cart", text: "A", line: 1 },
        { tag: "Cart 2.4", area: "Cart", text: "B", line: 3 },
      ],
    ],
    [
      "code fences are not parsed",
      lines("```", "Cart 2.4: not real", "# not a heading", "```", "Cart 2.5: real"),
      [{ tag: "Cart 2.5", area: "Cart", text: "real", line: 5 }],
    ],
    [
      "CRLF and a byte-order mark",
      "\uFEFFCart 2.4: A\r\nmore\r\n",
      [{ tag: "Cart 2.4", area: "Cart", text: "A more", line: 1 }],
    ],
  ])("%s", (_name, text, expected) => {
    expect(parsePrd({ file: FILE, text })).toStrictEqual(expected.map(req));
  });
});

describe("parsePrd — heading sections (file has no tags)", () => {
  it.each<[string, string, Row[]]>([
    [
      "h2 is the area, deeper headings inherit it; the h1 title is skipped",
      lines(
        "# Shop",
        "Intro.",
        "## Cart",
        "The cart shows items.",
        "### Discounts",
        "Codes are case-insensitive.",
        "## Checkout",
        "Guests can pay.",
      ),
      [
        { tag: "Cart", area: "Cart", text: "The cart shows items.", line: 3 },
        { tag: "Discounts", area: "Cart", text: "Codes are case-insensitive.", line: 5 },
        { tag: "Checkout", area: "Checkout", text: "Guests can pay.", line: 7 },
      ],
    ],
    [
      "only h1 sections: each is its own area",
      lines("# Cart", "Items listed.", "# Checkout", "Pay."),
      [
        { tag: "Cart", area: "Cart", text: "Items listed.", line: 1 },
        { tag: "Checkout", area: "Checkout", text: "Pay.", line: 3 },
      ],
    ],
    [
      "h3 under an h1 only takes the h1 as area",
      lines("# Cart", "### Discounts", "Case-insensitive."),
      [{ tag: "Discounts", area: "Cart", text: "Case-insensitive.", line: 2 }],
    ],
    [
      "a new h1 resets the area",
      lines("## Cart", "A.", "# Admin", "### Users", "B."),
      [
        { tag: "Cart", area: "Cart", text: "A.", line: 1 },
        { tag: "Users", area: "Admin", text: "B.", line: 4 },
      ],
    ],
    [
      "sections without a body are skipped",
      lines("## Cart", "## Checkout", "Pay."),
      [{ tag: "Checkout", area: "Checkout", text: "Pay.", line: 2 }],
    ],
    [
      "paragraphs keep line breaks between them",
      lines("## Cart", "Line one", "continues.", "", "Second para."),
      [{ tag: "Cart", area: "Cart", text: "Line one continues.\nSecond para.", line: 1 }],
    ],
    [
      "bullets and table rows keep their own lines",
      lines(
        "## Cart",
        "Rules:",
        "- one",
        "  wraps",
        "* two",
        "1. three",
        "",
        "| a | b |",
        "| - | - |",
      ),
      [
        {
          tag: "Cart",
          area: "Cart",
          text: "Rules:\n- one wraps\n* two\n1. three\n| a | b |\n| - | - |",
          line: 1,
        },
      ],
    ],
    [
      "a deep heading with no parent is its own area",
      lines("### Discounts", "Case-insensitive."),
      [{ tag: "Discounts", area: "Discounts", text: "Case-insensitive.", line: 1 }],
    ],
    [
      "a heading with no title is not a requirement",
      lines("##  ", "Orphan text.", "## Cart", "A."),
      [{ tag: "Cart", area: "Cart", text: "A.", line: 3 }],
    ],
    [
      "closing hashes are trimmed from headings",
      lines("## Cart ##", "A."),
      [{ tag: "Cart", area: "Cart", text: "A.", line: 1 }],
    ],
  ])("%s", (_name, text, expected) => {
    expect(parsePrd({ file: FILE, text })).toStrictEqual(expected.map(req));
  });
});

describe("parsePrd — nothing to extract", () => {
  it.each([
    ["empty file", ""],
    ["whitespace only", " \n\t\n"],
    ["plain prose", "The shop sells shoes.\nStep 1 is to open the cart."],
    ["a tag mentioned mid-sentence", "See Cart 2.4 for details."],
    ["lower-case area", "cart 2.4: x"],
    ["text before the first heading only", "Just an intro."],
  ])("%s -> []", (_name, text) => {
    expect(parsePrd({ file: FILE, text })).toStrictEqual([]);
  });
});

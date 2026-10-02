import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card, type CardTone } from "./Card.tsx";

describe("Card", () => {
  it("is a plain container by default: no role of its own", () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstElementChild;
    expect(card?.tagName).toBe("DIV");
    expect(card?.hasAttribute("role")).toBe(false);
  });

  it.each<[CardTone, readonly string[]]>([
    ["surface", ["bg-surface", "border-border-subtle", "p-5"]],
    ["sunken", ["bg-sunken", "border-border-strong", "px-3.5", "py-3"]],
  ])("%s has its measured look", (tone, classes) => {
    const { container } = render(<Card tone={tone}>Content</Card>);
    for (const c of classes) expect(container.firstElementChild?.className).toContain(c);
  });

  it.each([
    ["surface", "px-4 py-2.5"],
    ["sunken", "px-3.5 py-2.5"],
  ] as const)("sm %s is a row-like card", (tone, padding) => {
    const { container } = render(
      <Card tone={tone} size="sm">
        Row
      </Card>,
    );
    expect(container.firstElementChild?.className).toContain(padding);
  });

  it("an article is named by its own heading", () => {
    render(
      <Card as="article" labelledBy="t1">
        <h3 id="t1">Example title</h3>
      </Card>,
    );
    expect(screen.getByRole("article", { name: "Example title" })).toBeTruthy();
  });

  it("can be a list item in a list of cards", () => {
    render(
      <ul>
        <Card as="li">One</Card>
        <Card as="li">Two</Card>
      </ul>,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  // Checked at typecheck time (part of verify).
  it("takes no class, style or role from outside: screens compose, they do not restyle", () => {
    // @ts-expect-error closed props: no className
    render(<Card className="bg-raised">A</Card>);
    // @ts-expect-error closed props: no role
    render(<Card role="button">B</Card>);
    // @ts-expect-error only div, article or li (and a value from untyped data throws)
    expect(() => render(<Card as="button">C</Card>)).toThrow("Card cannot be a <button>");
    // @ts-expect-error only an article can be named
    const { container } = render(<Card labelledBy="x">D</Card>);
    expect(container.firstElementChild?.hasAttribute("aria-labelledby")).toBe(false);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

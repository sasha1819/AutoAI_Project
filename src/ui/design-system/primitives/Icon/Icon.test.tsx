import { render, screen } from "@testing-library/react";
import { CircleAlert, Folder } from "lucide-react";
import { describe, expect, it } from "vitest";
import { Icon, type IconSize } from "./Icon.tsx";

describe("Icon", () => {
  it("decorative: hidden from assistive tech and not focusable", () => {
    const { container } = render(<Icon glyph={Folder} decorative />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("focusable")).toBe("false");
    expect(svg?.hasAttribute("role")).toBe(false);
  });

  it("labelled: an image named by its label", () => {
    render(<Icon glyph={CircleAlert} label="Failed" />);
    const img = screen.getByRole("img", { name: "Failed" });
    expect(img.hasAttribute("aria-hidden")).toBe(false);
  });

  it.each<[IconSize, string]>([
    ["xs", "size-3"],
    ["sm", "size-3.5"],
    ["md", "size-4"],
    ["lg", "size-5"],
    ["xl", "size-6"],
  ])("size %s is %s, in the current text colour", (size, cls) => {
    const { container } = render(<Icon glyph={Folder} decorative size={size} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class")).toContain(cls);
    expect(svg?.getAttribute("stroke")).toBe("currentColor");
  });

  // The ts-expect-error lines are checked at typecheck time (part of verify); a blank label also throws at runtime.
  it("is either labelled or decorative, never neither or both", () => {
    const fromData: string = " ";
    expect(() => render(<Icon glyph={Folder} label={fromData} />)).toThrow(
      "Icon needs a non-empty label",
    );
    // @ts-expect-error neither a label nor decorative
    expect(() => render(<Icon glyph={Folder} />)).toThrow(/label/);
    // @ts-expect-error an empty label
    expect(() => render(<Icon glyph={Folder} label="" />)).toThrow(/label/);
    // @ts-expect-error both: decorative icons have no name
    render(<Icon glyph={Folder} decorative label="Folder" />);
    // @ts-expect-error an element instead of the glyph component
    expect(() => render(<Icon glyph={<Folder />} decorative />)).toThrow();
  });
});

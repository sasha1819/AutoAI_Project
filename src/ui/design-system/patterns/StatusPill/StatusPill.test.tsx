import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type BadgeTone, ToneBadge } from "../../primitives/_badge/index.ts";
import { type PillStatus, StatusDot, StatusIcon, StatusPill, statusWord } from "./StatusPill.tsx";

describe("StatusPill", () => {
  it.each<[PillStatus, string, BadgeTone]>([
    ["passed", "Passed", "passed"],
    ["failed", "Failed", "failed"],
    ["flaky", "Flaky", "warning"],
    ["running", "Running", "running"],
    ["not_run", "Not run", "neutral"],
  ])("%s: says %s in caps, in the %s tone, with a decorative icon", (status, word, tone) => {
    const { container } = render(<StatusPill status={status} />);
    const pill = screen.getByText(word);
    const { container: expected } = render(<ToneBadge label="x" tone={tone} uppercase />);
    expect(pill.className).toBe(expected.firstElementChild?.className);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("every status looks different: no two share a word, a tone or an icon", () => {
    const statuses: readonly PillStatus[] = ["passed", "failed", "flaky", "running", "not_run"];
    const words = new Set<string>();
    const tones = new Set<string>();
    const icons = new Set<string>();
    for (const s of statuses) {
      const { container, unmount } = render(<StatusPill status={s} />);
      words.add(container.textContent);
      tones.add(container.firstElementChild?.className ?? "");
      icons.add(container.querySelector("svg")?.getAttribute("class") ?? "");
      unmount();
    }
    expect([words.size, tones.size, icons.size]).toEqual([5, 5, 5]);
  });

  it("running turns its icon, and stops with reduced motion; the others stay still", () => {
    const { container, rerender } = render(<StatusPill status="running" />);
    expect(container.querySelector("svg")?.parentElement?.className).toContain(
      "motion-reduce:animate-none",
    );
    expect(container.querySelector("svg")?.parentElement?.className).toContain("animate-spin");
    rerender(<StatusPill status="passed" />);
    expect(container.querySelector("svg")?.parentElement?.className).not.toContain("animate-spin");
  });

  // The ts-expect-error lines are checked at typecheck time (part of verify).
  it("takes a domain status only: no colour, no unknown value", () => {
    const fromData: string = "exploded";
    // @ts-expect-error unknown values are refused (and throw at runtime)
    expect(() => render(<StatusPill status={fromData} />)).toThrow(/unknown status/);
    // @ts-expect-error screens never pick a colour
    render(<StatusPill status="passed" tone="failed" />);
    expect(screen.getByText("Passed").className).toBe(
      render(<ToneBadge label="y" tone="passed" uppercase />).container.firstElementChild
        ?.className,
    );
  });
});

describe("StatusIcon and StatusDot", () => {
  const ALL: readonly PillStatus[] = ["passed", "failed", "flaky", "running", "not_run"];

  it("use the pill's icon and say nothing themselves (the row says the word)", () => {
    for (const s of ALL) {
      const { container: icon, unmount: u1 } = render(<StatusIcon status={s} />);
      const { container: pill, unmount: u2 } = render(<StatusPill status={s} />);
      expect(icon.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
      // The same glyph (lucide names it in a class); only the size differs (12px in the pill, 14px in rows).
      const glyph = (root: HTMLElement) =>
        (root.querySelector("svg")?.getAttribute("class") ?? "")
          .split(" ")
          .filter((c) => c.startsWith("lucide-"));
      expect(glyph(icon)).toEqual(glyph(pill));
      expect(glyph(icon).length).toBeGreaterThan(0);
      u1();
      u2();
    }
  });

  it("each status has its own glyph colour and dot colour", () => {
    const glyphs = new Set<string>();
    const dots = new Set<string>();
    for (const s of ALL) {
      const { container, unmount } = render(
        <>
          <StatusIcon status={s} />
          <StatusDot status={s} />
        </>,
      );
      glyphs.add(container.children[0]?.className ?? "");
      dots.add(container.children[1]?.className ?? "");
      unmount();
    }
    expect([glyphs.size, dots.size]).toEqual([5, 5]);
  });

  it("statusWord gives the pill's word", () => {
    expect(ALL.map(statusWord)).toEqual(["Passed", "Failed", "Flaky", "Running", "Not run"]);
  });
});

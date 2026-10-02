import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(import.meta.dirname, "theme.css"), "utf8");

// Every theme block ([data-theme="…"], with or without :root) and its hex colour tokens. A light theme added later
// gets every assertion below without touching this file.
const themes = [...css.matchAll(/((?::root,\s*)?\[data-theme="([a-z]+)"\])\s*\{([^}]*)\}/g)].map(
  (m) => ({
    name: m[2] ?? "",
    colors: resolveAliases(m[3] ?? ""),
  }),
);

// Hex tokens of one theme block, with aliases (--tk-a: var(--tk-b)) resolved to the colour they point at.
function resolveAliases(block: string): Map<string, string> {
  const colors = new Map(
    [...block.matchAll(/--tk-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/g)].map((c) => [
      c[1] ?? "",
      c[2] ?? "",
    ]),
  );
  for (const c of block.matchAll(/--tk-([a-z-]+):\s*var\(--tk-([a-z-]+)\)\s*;/g)) {
    const target = colors.get(c[2] ?? "");
    if (target !== undefined) colors.set(c[1] ?? "", target);
  }
  return colors;
}

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const SURFACES = ["bg-canvas", "bg-surface", "bg-sunken", "bg-raised", "bg-selected", "bg-hover"];
const TEXT = [
  "field-invalid",
  "text-primary",
  "text-secondary",
  "text-muted",
  "text-link",
  "code-ref",
  "ai-text",
  "status-passed",
  "status-failed",
  "status-warning",
  "status-running",
];
const PAIRS = [
  ["text-on-accent", "accent"],
  ["text-on-accent", "accent-hover"],
  ["text-on-accent", "accent-pressed"],
  ["status-passed", "status-passed-surface"],
  ["status-failed-text", "status-failed-surface"],
  ["status-warning", "status-warning-surface"],
  ["status-running", "status-running-surface"],
  ["text-secondary", "status-neutral-surface"],
  ["ai-text", "ai-surface"],
  ["ai-text", "ai-tile"],
] as const;
// Graphics that must stand out from a specific neighbour (3:1, WCAG non-text contrast).
const GRAPHIC_PAIRS = [
  ["progress-active", "progress-track"],
  ["progress-passed", "progress-track"],
  ["progress-failed", "progress-track"],
  ["meter-fill", "meter-track"],
] as const;
// Tokens whose value is not a single hex colour (rgb with alpha, shadows, numbers).
const NOT_HEX = new Set(["opacity-disabled", "scrim", "shadow-overlay"]);

describe("design tokens", () => {
  it("has a dark theme, the default", () => {
    expect(themes.map((t) => t.name)).toContain("dark");
    expect(css).toMatch(/:root,\s*\[data-theme="dark"\]/);
  });

  it.each([
    "--color-*",
    "--text-*",
    "--radius-*",
    "--shadow-*",
    "--inset-shadow-*",
    "--drop-shadow-*",
    "--text-shadow-*",
    "--blur-*",
    "--font-weight-*",
  ])("switches off Tailwind's own %s values (they carry raw values)", (reset) => {
    expect(css).toContain(`${reset}: initial;`);
  });

  describe.each(themes)("$name theme", ({ colors }) => {
    const color = (name: string): string => {
      const value = colors.get(name);
      if (value === undefined) throw new Error(`missing token --tk-${name}`);
      return value;
    };

    it("defines every token the Tailwind layer maps", () => {
      const referenced = [...css.matchAll(/var\(--tk-([a-z-]+)\)/g)].map((m) => m[1] ?? "");
      expect(referenced.length).toBeGreaterThan(30);
      for (const name of referenced) {
        if (!NOT_HEX.has(name)) expect(colors.has(name), `--tk-${name}`).toBe(true);
      }
    });

    it.each(TEXT)("%s text meets WCAG AA (4.5:1) on every surface", (name) => {
      for (const surface of SURFACES) {
        expect(
          contrast(color(name), color(surface)),
          `${name} on ${surface}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });

    it.each(PAIRS)("%s on %s meets WCAG AA (4.5:1)", (text, surface) => {
      expect(contrast(color(text), color(surface))).toBeGreaterThanOrEqual(4.5);
    });

    it.each(GRAPHIC_PAIRS)("%s against %s is visible (3:1)", (graphic, neighbour) => {
      expect(contrast(color(graphic), color(neighbour))).toBeGreaterThanOrEqual(3);
    });

    it("status dots, field edges and the focus ring are visible (3:1, WCAG non-text contrast)", () => {
      for (const graphic of [
        "status-neutral",
        "status-passed",
        "status-failed",
        "status-warning",
        "status-running",
        "focus-ring",
        "border-field",
        "border-field-hover",
        "progress-active",
        "progress-passed",
        "progress-failed",
        "toast-error-icon",
      ]) {
        for (const surface of [...SURFACES, "bg-app"]) {
          expect(
            contrast(color(graphic), color(surface)),
            `${graphic} on ${surface}`,
          ).toBeGreaterThanOrEqual(3);
        }
      }
    });
  });
});

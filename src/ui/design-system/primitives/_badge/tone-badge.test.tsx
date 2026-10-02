import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type BadgeTone, ToneBadge } from "./tone-badge.tsx";

describe("ToneBadge (for StatusPill and SeverityTag)", () => {
  it.each<[BadgeTone, string, string]>([
    ["plain", "border-border-default", "bg-raised"],
    ["neutral", "bg-status-neutral-surface", "text-text-secondary"],
    ["passed", "bg-status-passed-surface", "text-status-passed"],
    ["failed", "bg-status-failed-surface", "text-status-failed-text"],
    ["warning", "bg-status-warning-surface", "text-status-warning"],
    ["running", "bg-status-running-surface", "text-status-running"],
  ])("%s uses its own surface and text tokens", (tone, fill, text) => {
    render(<ToneBadge label="Example" tone={tone} />);
    const badge = screen.getByText("Example");
    expect(badge.className).toContain(fill);
    expect(badge.className).toContain(text);
  });

  it("always says its meaning in words: a blank label throws", () => {
    const fromData: string = " ";
    expect(() => render(<ToneBadge label={fromData} tone="failed" />)).toThrow(
      "Badge needs a non-empty label",
    );
  });
});

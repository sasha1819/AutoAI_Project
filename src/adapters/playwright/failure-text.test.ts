import { describe, expect, it } from "vitest";
import { pageSnapshotOf, stripAnsi } from "./failure-text.ts";

describe("stripAnsi", () => {
  it("removes terminal colour codes", () => {
    expect(stripAnsi("\u001b[2mexpect(\u001b[22m\u001b[31mlocator\u001b[39m)")).toBe(
      "expect(locator)",
    );
  });
});

describe("pageSnapshotOf", () => {
  const context = [
    "# Instructions",
    "- Explain why, be concise.",
    "",
    "# Page snapshot",
    "",
    "```yaml",
    '- heading "Cart" [level=1]',
    '- paragraph: "Total: 0"',
    "```",
    "",
    "# Test source",
    "",
    "```ts",
    "test('x', () => {});",
    "```",
  ].join("\n");

  it("keeps only the snapshot, not Playwright's AI instructions or the test source", () => {
    expect(pageSnapshotOf(context)).toBe('- heading "Cart" [level=1]\n- paragraph: "Total: 0"');
  });

  it("has no snapshot when the file has none", () => {
    expect(pageSnapshotOf("# Error details\n\n```\nboom\n```\n")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { err, ok } from "../core/domain/result.ts";
import type { RepoReadError } from "../core/ports/repo-reader.ts";
import { extractRequirements } from "./extract-requirements.ts";
import { inMemoryRepoReader } from "./testing/in-memory-repo-reader.ts";

// Every test here reads a single PRD folder, named "docs/prds" or "p".
const fakeReader = (
  files: Record<string, string>,
  fail: { list?: RepoReadError; read?: Record<string, RepoReadError> } = {},
) =>
  inMemoryRepoReader(
    { "docs/prds": files, p: files },
    {
      ...(fail.list ? { list: { "docs/prds": fail.list, p: fail.list } } : {}),
      ...(fail.read ? { read: fail.read } : {}),
    },
  );

describe("extractRequirements", () => {
  it("reads only PRD files and returns their requirements in file, then line order", async () => {
    const reader = fakeReader({
      "checkout/flow.md": "## Checkout\nGuests can pay.",
      "cart.md": "Cart 2.4: Codes are case-insensitive.\n\nCart 2.5: Totals update live.",
      "logo.png": "binary",
      ".drafts/old.md": "Cart 9.9: stale",
    });

    const result = await extractRequirements({ repoReader: reader }, { prdFolder: "docs/prds" });

    expect(result).toStrictEqual(
      ok({
        prdFiles: ["cart.md", "checkout/flow.md"],
        requirements: [
          {
            tag: "Cart 2.4",
            area: "Cart",
            text: "Codes are case-insensitive.",
            source: { file: "cart.md", line: 1 },
          },
          {
            tag: "Cart 2.5",
            area: "Cart",
            text: "Totals update live.",
            source: { file: "cart.md", line: 3 },
          },
          {
            tag: "Checkout",
            area: "Checkout",
            text: "Guests can pay.",
            source: { file: "checkout/flow.md", line: 1 },
          },
        ],
      }),
    );
    expect(reader.calls).toStrictEqual([
      "list docs/prds",
      "read docs/prds cart.md",
      "read docs/prds checkout/flow.md",
    ]);
  });

  it("succeeds with no requirements when PRD files have none", async () => {
    const result = await extractRequirements(
      { repoReader: fakeReader({ "notes.txt": "Just prose." }) },
      { prdFolder: "p" },
    );
    expect(result).toStrictEqual(ok({ prdFiles: ["notes.txt"], requirements: [] }));
  });

  it.each([{}, { "logo.png": "x", ".hidden.md": "Cart 1.1: x" }])(
    "fails with NO_PRD_FILES when the folder has no PRD files (%j)",
    async (files) => {
      const result = await extractRequirements(
        { repoReader: fakeReader(files) },
        { prdFolder: "p" },
      );
      expect(result.ok ? null : result.error.code).toBe("NO_PRD_FILES");
    },
  );

  it.each<RepoReadError["code"]>(["PATH_NOT_FOUND", "NOT_A_DIRECTORY", "PATH_UNREADABLE"])(
    "passes through %s when the folder cannot be listed",
    async (code) => {
      const error = { code, message: "p" };
      const result = await extractRequirements(
        { repoReader: fakeReader({}, { list: error }) },
        { prdFolder: "p" },
      );
      expect(result).toStrictEqual(err(error));
    },
  );

  it.each<RepoReadError["code"]>(["PATH_UNREADABLE", "NOT_A_FILE", "PATH_OUTSIDE_ROOT"])(
    "stops at the first PRD file that cannot be read (%s)",
    async (code) => {
      const error = { code, message: "b.md" };
      const reader = fakeReader(
        { "a.md": "Cart 1.1: A", "b.md": "x", "c.md": "Cart 1.2: C" },
        { read: { "b.md": error } },
      );
      const result = await extractRequirements({ repoReader: reader }, { prdFolder: "p" });
      expect(result).toStrictEqual(err(error));
      expect(reader.calls).not.toContain("read p c.md");
    },
  );
});

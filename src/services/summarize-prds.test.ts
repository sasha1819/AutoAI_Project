import { describe, expect, it } from "vitest";
import { ok } from "../core/domain/result.ts";
import { summarizePrds } from "./summarize-prds.ts";
import { inMemoryRepoReader } from "./testing/in-memory-repo-reader.ts";

const summarize = (files: Record<string, string>) =>
  summarizePrds({ repoReader: inMemoryRepoReader({ p: files }) }, { prdFolder: "p" });

describe("summarizePrds", () => {
  it("counts the requirements in each PRD file, keeping files that have none", async () => {
    const result = await summarize({
      "cart.md": "Cart 2.4: Codes are case-insensitive.\n\nCart 2.5: Totals update live.",
      "checkout.md": "## Checkout\nGuests can pay.",
      "notes.txt": "Just prose, with no headings or tags.",
    });
    expect(result).toStrictEqual(
      ok({
        files: [
          { file: "cart.md", requirements: 2 },
          { file: "checkout.md", requirements: 1 },
          { file: "notes.txt", requirements: 0 },
        ],
        requirements: 3,
      }),
    );
  });

  it("answers 0 requirements for PRDs written as plain prose (the screen must say so)", async () => {
    expect(
      await summarize({ "vision.md": "We want a fast checkout.\nIt should be easy." }),
    ).toStrictEqual(ok({ files: [{ file: "vision.md", requirements: 0 }], requirements: 0 }));
  });

  it("passes NO_PRD_FILES through when the folder has none", async () => {
    const result = await summarize({ "logo.png": "x" });
    expect(result.ok ? null : result.error.code).toBe("NO_PRD_FILES");
  });

  it("passes read errors through", async () => {
    const result = await summarizePrds(
      { repoReader: inMemoryRepoReader({}) },
      { prdFolder: "missing" },
    );
    expect(result.ok ? null : result.error.code).toBe("PATH_NOT_FOUND");
  });
});

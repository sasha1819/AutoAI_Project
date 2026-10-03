import { describe, expect, it } from "vitest";
import { ok } from "../core/domain/result.ts";
import { MAX_EXTRACTION_CHARS } from "../core/rules/extraction.ts";
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
          { file: "cart.md", requirements: 2, chars: 68, claude: "not_needed" },
          { file: "checkout.md", requirements: 1, chars: 27, claude: "not_needed" },
          { file: "notes.txt", requirements: 0, chars: 37, claude: "will_read" },
        ],
        requirements: 3,
        maxChars: MAX_EXTRACTION_CHARS,
        extraCalls: 1,
      }),
    );
  });

  it("answers 0 requirements for PRDs written as plain prose (the screen must say so)", async () => {
    expect(
      await summarize({ "vision.md": "We want a fast checkout.\nIt should be easy." }),
    ).toStrictEqual(
      ok({
        files: [{ file: "vision.md", requirements: 0, chars: 43, claude: "will_read" }],
        requirements: 0,
        maxChars: MAX_EXTRACTION_CHARS,
        extraCalls: 1,
      }),
    );
  });

  it("a plain-prose file over the size cap is marked too large for Claude", async () => {
    const result = await summarize({ "big.md": "word ".repeat(MAX_EXTRACTION_CHARS) });
    expect(result.ok && result.value.files[0]?.claude).toBe("too_large");
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

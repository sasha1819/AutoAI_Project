import { describe, expect, it } from "vitest";
import { loadSourceFiles } from "./source-files.ts";
import { inMemoryRepoReader } from "./testing/in-memory-repo-reader.ts";

const repo = { "src/a.ts": "a", "src/b.test.ts": "b", "README.md": "r", "src/c.js": "c" };

describe("loadSourceFiles", () => {
  it("lists every file, picks the source files and reads them", async () => {
    const result = await loadSourceFiles(inMemoryRepoReader({ repo }), "repo", {
      readContents: true,
    });
    expect(result).toStrictEqual({
      ok: true,
      value: {
        allPaths: ["README.md", "src/a.ts", "src/b.test.ts", "src/c.js"],
        sourcePaths: ["src/a.ts", "src/c.js"],
        files: [
          { path: "src/a.ts", text: "a" },
          { path: "src/c.js", text: "c" },
        ],
        warnings: [],
      },
    });
  });

  it("reads nothing when contents are not needed", async () => {
    const reader = inMemoryRepoReader({ repo });
    const result = await loadSourceFiles(reader, "repo", { readContents: false });
    expect(result.ok && result.value.files).toStrictEqual([]);
    expect(reader.calls).toStrictEqual(["list repo"]);
  });

  it("skips an unreadable file with a warning", async () => {
    const reader = inMemoryRepoReader(
      { repo },
      { read: { "src/c.js": { code: "PATH_UNREADABLE", message: "denied" } } },
    );
    const result = await loadSourceFiles(reader, "repo", { readContents: true });
    expect(result.ok && result.value.warnings).toStrictEqual([
      { code: "SOURCE_FILE_UNREADABLE", message: "src/c.js: denied" },
    ]);
  });

  it("fails when the repo cannot be listed", async () => {
    const result = await loadSourceFiles(inMemoryRepoReader({}), "repo", { readContents: true });
    expect(result.ok ? null : result.error.code).toBe("PATH_NOT_FOUND");
  });
});

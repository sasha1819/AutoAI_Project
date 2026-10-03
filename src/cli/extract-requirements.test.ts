import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Runs the real entry point with plain `node` (ADR 0003), so this also proves the CLI executes without a build.
const ENTRY = join(import.meta.dirname, "extract-requirements.ts");
let base: string;

function run(...args: string[]) {
  const r = spawnSync(process.execPath, [ENTRY, ...args], { encoding: "utf8" });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "autoai-cli-"));
  mkdirSync(join(base, "prds"));
  writeFileSync(join(base, "prds", "cart.md"), "Cart 2.4: Codes are case-insensitive.\n");
  writeFileSync(join(base, "prds", "logo.png"), "x");
  mkdirSync(join(base, "no-prds"));
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

// Spawning a real node process is slow while the rest of the suite runs in parallel, hence the longer timeout.
describe("npm run requirements", { timeout: 20_000 }, () => {
  it("prints the requirements it found", () => {
    const r = run("--prds", join(base, "prds"));
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Found 1 requirement in 1 PRD file");
    expect(r.stdout).toContain("Cart 2.4  Codes are case-insensitive.  (cart.md:1)");
  });

  it("prints JSON with --json", () => {
    const r = run("--prds", join(base, "prds"), "--json");
    expect(r.code).toBe(0);
    expect(JSON.parse(r.stdout)).toStrictEqual({
      prdFiles: ["cart.md"],
      requirements: [
        {
          tag: "Cart 2.4",
          area: "Cart",
          text: "Codes are case-insensitive.",
          source: { file: "cart.md", line: 1 },
        },
      ],
      files: [{ file: "cart.md", chars: expect.any(Number) as number, requirements: 1 }],
    });
  });

  it.each([
    ["the folder does not exist", "missing", "PATH_NOT_FOUND"],
    ["the folder has no PRD files", "no-prds", "NO_PRD_FILES"],
  ])("exits 1 with the error code when %s", (_name, folder, code) => {
    const r = run("--prds", join(base, folder));
    expect(r.code).toBe(1);
    expect(r.stderr).toContain(code);
    expect(r.stdout).toBe("");
  });

  it.each([[[]], [["--prds"]], [["--prds", ""]], [["--prds", "x", "--nope"]], [["stray"]]])(
    "exits 2 with usage for bad arguments %j",
    (args) => {
      const r = run(...args);
      expect(r.code).toBe(2);
      expect(r.stderr).toContain("Usage: npm run requirements -- --prds <folder> [--json]");
    },
  );
});

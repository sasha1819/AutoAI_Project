import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Spawns the real entry with plain node. Only paths that never reach the network are exercised here; a live scan
// needs the user's key and is the scan-evaluator's job.
const ENTRY = join(import.meta.dirname, "scan.ts");
const USAGE =
  "Usage: npm run scan -- --repo <folder> --prds <folder> [--out <file.json>] [--model <id>] [--effort low|medium|high] [--record <folder>] [--json]";
let base: string;

function run(
  args: string[],
  env: Record<string, string | undefined> = { ANTHROPIC_API_KEY: "sk-ant-not-used" },
) {
  // Start from the real environment minus anything that would reach the network or pick a model.
  const merged: Record<string, string | undefined> = {
    ...process.env,
    ANTHROPIC_API_KEY: undefined,
    AUTOAI_MODEL: undefined,
    ...env,
  };
  const clean: Record<string, string> = {};
  for (const [name, value] of Object.entries(merged)) if (value !== undefined) clean[name] = value;
  const r = spawnSync(process.execPath, [ENTRY, ...args], { encoding: "utf8", env: clean });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "autoai-scan-cli-"));
  mkdirSync(join(base, "repo", "src"), { recursive: true });
  writeFileSync(join(base, "repo", "src", "app.js"), "export const x = 1;\n");
  mkdirSync(join(base, "no-prds"));
  writeFileSync(join(base, "no-prds", "logo.png"), "x");
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe("npm run scan", () => {
  it.each([
    ["no key at all", {}],
    ["a blank key", { ANTHROPIC_API_KEY: "   " }],
  ])("exits 2 and explains bring-your-own-key when there is %s", (_name, env) => {
    const r = run(["--repo", join(base, "repo"), "--prds", join(base, "no-prds")], env);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/ANTHROPIC_API_KEY/);
    expect(r.stderr).toMatch(/api\.anthropic\.com/);
  });

  it.each([
    [["--prds", "p"]],
    [["--repo", "r"]],
    [["--repo", "r", "--prds", "p", "--effort", "extreme"]],
    [["--repo", "r", "--prds", "p", "--model", ""]],
    [["--repo", "r", "--prds", "p", "--nope"]],
  ])("exits 2 with usage for bad arguments %j", (args) => {
    const r = run(args);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain(USAGE);
  });

  it("exits 1 with the error code when a folder is missing", () => {
    const r = run(["--repo", join(base, "repo"), "--prds", join(base, "missing")]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("PATH_NOT_FOUND");
  });

  it("scans nothing, calls no AI, and still writes --out when there are no PRD files", () => {
    const out = join(base, "out", "result.json");
    const r = run(["--repo", join(base, "repo"), "--prds", join(base, "no-prds"), "--out", out]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Scanned 0 requirements from 0 PRD files against 1 source files");
    expect(r.stdout).toContain("NO_PRD_FILES");
    const saved = JSON.parse(readFileSync(out, "utf8")) as {
      warnings: { code: string }[];
      usage: { aiCalls: number };
    };
    expect(saved.warnings.map((w) => w.code)).toStrictEqual(["NO_PRD_FILES"]);
    expect(saved.usage.aiCalls).toBe(0);
  });

  it("still prints the result and exits 1 when --out cannot be written", () => {
    const blocker = join(base, "blocker");
    writeFileSync(blocker, "x");
    const r = run([
      "--repo",
      join(base, "repo"),
      "--prds",
      join(base, "no-prds"),
      "--out",
      join(blocker, "r.json"),
    ]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("Scanned 0 requirements");
    expect(r.stderr).toMatch(/Could not write --out .*blocker/);
  });

  it("warns in the usage that --record saves your source code", () => {
    const r = run([]);
    expect(r.stderr).toMatch(/--record saves each prompt, which contains your source code/);
  });

  it("prints the result as JSON with --json", () => {
    const r = run(["--repo", join(base, "repo"), "--prds", join(base, "no-prds"), "--json"]);
    expect(r.code).toBe(0);
    expect((JSON.parse(r.stdout) as { sourceFiles: number }).sourceFiles).toBe(1);
  });
});

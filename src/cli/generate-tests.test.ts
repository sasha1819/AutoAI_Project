import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Spawns the real entry with plain node, only on paths that never reach the network.
const ENTRY = join(import.meta.dirname, "generate-tests.ts");
const USAGE =
  "Usage: npm run generate-tests -- --repo <folder> --from <scan-result.json> [--out <file.json>] [--model <id>] [--effort low|medium|high] [--json]";
let base: string;

function run(
  args: string[],
  env: Record<string, string | undefined> = { ANTHROPIC_API_KEY: "sk-ant-not-used" },
) {
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

const notImplemented = {
  requirement: {
    tag: "Account 3.1",
    area: "Account",
    text: "Order history.",
    source: { file: "shop.md", line: 19 },
  },
  type: "not_implemented",
  severity: "medium",
  explanation: "No order history page.",
  evidence: null,
  confidence: 0.9,
  reviewStatus: "confirmed",
  reviewReasons: [],
};

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "autoai-gen-cli-"));
  mkdirSync(join(base, "repo"));
  writeFileSync(join(base, "repo", "index.html"), "<h1>Shop</h1>");
  writeFileSync(
    join(base, "scan.json"),
    JSON.stringify({ findings: [notImplemented], models: ["x"] }),
  );
  writeFileSync(join(base, "bad.json"), "{not json");
  writeFileSync(join(base, "wrong-shape.json"), JSON.stringify({ findings: [{ type: "match" }] }));
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

// Spawning a real node process is slow while the rest of the suite runs in parallel, hence the longer timeout.
describe("npm run generate-tests", { timeout: 20_000 }, () => {
  it("exits 2 with the bring-your-own-key message when there is no key", () => {
    const r = run(["--repo", join(base, "repo"), "--from", join(base, "scan.json")], {});
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/ANTHROPIC_API_KEY.*api\.anthropic\.com/s);
  });

  it.each([
    [["--from", "x.json"]],
    [["--repo", "r"]],
    [["--repo", "r", "--from", "x.json", "--effort", "max"]],
  ])("exits 2 with usage for bad arguments %j", (args) => {
    const r = run(args);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain(USAGE);
  });

  it.each([
    ["a missing scan file", "missing.json", /INVALID_SCAN_FILE: .*missing\.json/],
    ["a scan file that is not JSON", "bad.json", /INVALID_SCAN_FILE: .*bad\.json.*not valid JSON/],
    [
      "a scan file with the wrong shape",
      "wrong-shape.json",
      /INVALID_SCAN_FILE: .*wrong-shape\.json.*findings/,
    ],
  ])("exits 1 for %s", (_name, file, message) => {
    const r = run(["--repo", join(base, "repo"), "--from", join(base, file)]);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(message);
  });

  it("generates nothing, calls no AI and writes no files when no finding qualifies", () => {
    const out = join(base, "gen.json");
    const r = run(["--repo", join(base, "repo"), "--from", join(base, "scan.json"), "--out", out]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Generated tests for 0 of 1 findings");
    expect(existsSync(join(base, "repo", "tests"))).toBe(false);
    expect(
      (JSON.parse(readFileSync(out, "utf8")) as { usage: { aiCalls: number } }).usage.aiCalls,
    ).toBe(0);
  });
});

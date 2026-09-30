import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Spawns the real entry with plain node, only on paths that never reach the network.
const ENTRY = join(import.meta.dirname, "diagnose.ts");
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

const passed = { result: "passed", durationMs: 10, steps: [] };
const failed = {
  result: "failed",
  durationMs: 10,
  steps: [],
  failure: { step: null, error: "boom" },
};
const savedRun = (status: string, attempts: unknown[]) => ({
  runId: "run-1",
  repoRoot: join(base, "repo"),
  specPath: "tests/autoai/cart.spec.ts",
  status,
  attempts,
});

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "autoai-diagnose-cli-"));
  writeFileSync(join(base, "passed.json"), JSON.stringify(savedRun("passed", [passed])));
  writeFileSync(join(base, "flaky.json"), JSON.stringify(savedRun("flaky", [failed, passed])));
  // Hand-edited: says failed, but the retry passed.
  writeFileSync(join(base, "edited.json"), JSON.stringify(savedRun("failed", [failed, passed])));
  writeFileSync(join(base, "bad.json"), "{not json");
  writeFileSync(join(base, "wrong-shape.json"), JSON.stringify({ status: "failed" }));
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe("npm run diagnose", { timeout: 20_000 }, () => {
  it.each([
    ["no arguments", []],
    ["an unknown option", ["--run", "x", "--nope"]],
  ])("%s -> usage, exit 2", (_name, args) => {
    const r = run(args);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Usage: npm run diagnose -- --run <run.json>");
    expect(r.stderr).toContain("Secrets (tokens, passwords, cookies, auth headers) are hidden");
  });

  it("no API key -> explains BYOK, exit 2", () => {
    const r = run(["--run", join(base, "passed.json")], {});
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("ANTHROPIC_API_KEY");
  });

  it.each([
    ["a missing file", "missing.json", "INVALID_RUN_FILE"],
    ["broken JSON", "bad.json", "INVALID_RUN_FILE"],
    ["a file that is not a run", "wrong-shape.json", "not a saved run"],
  ])("%s -> %s, exit 1", (_name, file, message) => {
    const r = run(["--run", join(base, file)]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain(message);
  });

  it.each(["passed", "flaky"])("a %s run is never sent to the AI, exit 1", (status) => {
    const r = run(["--run", join(base, `${status}.json`)]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain(`NOT_A_CONFIRMED_FAILURE: The run is ${status}`);
  });

  it("a saved run whose status does not match its attempts is refused, exit 1", () => {
    const r = run(["--run", join(base, "edited.json")]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("INCONSISTENT_RUN: The saved run says failed");
  });
});

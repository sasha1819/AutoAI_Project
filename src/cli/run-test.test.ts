import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Spawns the real entry with plain node against a throwaway repo that uses AutoAI's own Playwright + Chromium.
const ENTRY = join(import.meta.dirname, "run-test.ts");
const AUTOAI_PLAYWRIGHT = join(import.meta.dirname, "../../node_modules/@playwright/test");
const SPEC = "tests/autoai/cart.spec.ts";
let base: string;
let repo: string;

function run(args: string[]) {
  const r = spawnSync(process.execPath, [ENTRY, ...args], { encoding: "utf8" });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "autoai-run-cli-"));
  repo = join(base, "repo");
  mkdirSync(join(repo, "tests", "autoai"), { recursive: true });
  mkdirSync(join(repo, "node_modules", "@playwright"), { recursive: true });
  symlinkSync(AUTOAI_PLAYWRIGHT, join(repo, "node_modules", "@playwright", "test"));
  writeFileSync(join(repo, "package.json"), '{ "type": "module" }\n');
  writeFileSync(join(repo, "playwright.config.mjs"), "export default {};\n");
  // Fails on its first run and passes on the next: a flaky test.
  writeFileSync(
    join(repo, SPEC),
    [
      'import fs from "node:fs";',
      'import { expect, test } from "@playwright/test";',
      'test("cart total", async ({ page }) => {',
      '  await page.setContent("<p id=t>Total: 0</p>");',
      '  const file = new URL("./runs.txt", import.meta.url);',
      '  const runs = (fs.existsSync(file) ? Number(fs.readFileSync(file, "utf8")) : 0) + 1;',
      "  fs.writeFileSync(file, String(runs));",
      '  await expect(page.locator("#t")).toHaveText(runs > 1 ? "Total: 0" : "Total: 5", { timeout: 300 });',
      "});",
    ].join("\n"),
  );
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe("npm run run-test", { timeout: 60_000 }, () => {
  it.each([
    ["no arguments", []],
    ["a missing --spec", ["--repo", "x"]],
    ["an unknown option", ["--repo", "x", "--spec", "y", "--retries", "3"]],
  ])("%s -> usage, exit 2", (_name, args) => {
    const r = run(args);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Usage: npm run run-test -- --repo <folder> --spec");
  });

  it("a spec outside tests/autoai -> the runner's error, exit 1", () => {
    const r = run(["--repo", repo, "--spec", "package.json"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("PATH_NOT_ALLOWED");
  });

  it("a flaky test: live log for both attempts, FLAKY shown plainly, exit 0, both attempts in --out", () => {
    const artifacts = join(base, "artifacts");
    const out = join(base, "run.json");
    const r = run(["--repo", repo, "--spec", SPEC, "--artifacts", artifacts, "--out", out]);

    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Attempt 1\n");
    expect(r.stdout).toContain("  FAIL Expect \"toHaveText\" locator('#t')");
    expect(r.stdout).toContain("Attempt 2 (retry, same conditions)\n");
    expect(r.stdout).toContain(`${SPEC}: FLAKY: failed, then passed on the retry.`);
    const saved = JSON.parse(readFileSync(out, "utf8")) as {
      status: string;
      attempts: { result: string; failure?: { screenshotPath?: string } }[];
    };
    expect(saved.status).toBe("flaky");
    expect(saved.attempts.map((a) => a.result)).toStrictEqual(["failed", "passed"]);
    expect(saved.attempts[0]?.failure?.screenshotPath?.startsWith(artifacts)).toBe(true);
  });
});

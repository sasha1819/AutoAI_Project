import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { RunId } from "../../core/domain/ids.ts";
import { StepEvent } from "../../core/domain/step.ts";
import type { AttemptRequest } from "../../core/ports/test-runner.ts";
import { createPlaywrightTestRunner } from "./playwright-test-runner.ts";

// Real runs: each case is a throwaway repo whose node_modules/@playwright/test points at AutoAI's own copy, run with
// real Chromium (npx playwright install chromium). Slow-ish, so the cases run concurrently.
const AUTOAI_PLAYWRIGHT = join(import.meta.dirname, "../../../node_modules/@playwright/test");
const CONFIG = "export default { use: {} };\n";
const PAGE = "<h1>Cart</h1><p id=t>Total: 0</p><button>Add</button>";

const spec = (body: string, header = ""): string =>
  [
    'import { expect, test } from "@playwright/test";',
    header,
    'test("cart total", async ({ page }) => {',
    `  await page.setContent(${JSON.stringify(PAGE)});`,
    body,
    "});",
  ].join("\n");
const passing = spec('  await expect(page.locator("#t")).toHaveText("Total: 0");');
const failing = spec(
  '  await expect(page.locator("#t")).toHaveText("Total: 5", { timeout: 300 });',
);

type RepoSetup = {
  /** null leaves a default file out. */
  readonly files?: Record<string, string | null>;
  readonly install?: boolean;
};

async function makeRepo(setup: RepoSetup = {}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "autoai-runner-repo-"));
  const files: Record<string, string | null> = {
    "package.json": '{ "type": "module" }\n',
    "playwright.config.mjs": CONFIG,
    ...setup.files,
  };
  for (const [path, text] of Object.entries(files)) {
    if (text === null) continue;
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), text);
  }
  if (setup.install ?? true) {
    await mkdir(join(root, "node_modules", "@playwright"), { recursive: true });
    await symlink(AUTOAI_PLAYWRIGHT, join(root, "node_modules", "@playwright", "test"));
  }
  return root;
}

const artifactsDir = await mkdtemp(join(tmpdir(), "autoai-runner-artifacts-"));
const runner = createPlaywrightTestRunner({ artifactsDir });
let nextId = 0;
const request = (repoRoot: string, over: Partial<AttemptRequest> = {}): AttemptRequest => ({
  repoRoot,
  specPath: "tests/autoai/cart.spec.ts",
  runId: RunId.parse(`run-${String((nextId += 1))}`),
  attempt: 1,
  timeLimitMs: 45_000,
  ...over,
});

describe.concurrent(
  "PlaywrightTestRunner (real Playwright + Chromium)",
  { timeout: 60_000 },
  () => {
    it("passes, streaming typed steps (actions and checks, not browser setup)", async () => {
      const root = await makeRepo({
        files: {
          "playwright.config.ts":
            'import { defineConfig } from "@playwright/test";\nexport default defineConfig({});\n',
          "playwright.config.mjs": null,
          "tests/autoai/cart.spec.ts": passing,
        },
      });
      // The user's TypeScript config is loaded through AutoAI's .mjs wrapper.
      const streamed: StepEvent[] = [];
      const req = request(root);
      const result = await runner.runAttempt(req, (e) => streamed.push(e));

      expect(result.ok && result.value.result).toBe("passed");
      if (!result.ok) return;
      expect(streamed).toStrictEqual(result.value.steps);
      for (const event of streamed) expect(StepEvent.parse(event)).toStrictEqual(event);
      expect(streamed.every((e) => e.runId === req.runId && e.attempt === 1)).toBe(true);
      expect(streamed.map((e) => `${e.status} ${e.step}`)).toStrictEqual([
        "running Set content",
        "passed Set content",
        "running Expect \"toHaveText\" locator('#t')",
        "passed Expect \"toHaveText\" locator('#t')",
      ]);
    });

    it("fails, capturing the failed step, a clean error, a screenshot and the page snapshot", async () => {
      const root = await makeRepo({ files: { "tests/autoai/cart.spec.ts": failing } });
      const req = request(root);
      const result = await runner.runAttempt(req, () => undefined);

      expect(result.ok && result.value.result).toBe("failed");
      if (!result.ok || result.value.result !== "failed") return;
      const { failure, steps } = result.value;
      expect(failure.step).toBe("Expect \"toHaveText\" locator('#t')");
      expect(failure.error).toContain('Expected: "Total: 5"');
      expect(failure.error).not.toContain("\u001b");
      expect(failure.screenshotPath?.startsWith(join(artifactsDir, req.runId, "attempt-1"))).toBe(
        true,
      );
      expect(existsSync(failure.screenshotPath ?? "")).toBe(true);
      expect(failure.pageSnapshot).toContain("Total: 0");
      expect(steps.at(-1)?.status).toBe("failed");
    });

    it("counts a timeout as a failure", async () => {
      const body = '  test.setTimeout(1500);\n  await page.locator("#never").click();';
      const root = await makeRepo({ files: { "tests/autoai/cart.spec.ts": spec(body) } });
      const result = await runner.runAttempt(request(root), () => undefined);
      expect(result.ok && result.value.result === "failed" && result.value.failure.error).toMatch(
        /timeout/i,
      );
    });

    it("never retries: the user's retries are ignored, and only the first try of an in-spec retry counts", async () => {
      // The spec counts its own runs in a file; it fails on the first run and passes on any later one.
      const counting = spec(
        [
          '  const file = new URL("./runs.txt", import.meta.url);',
          '  const runs = (fs.existsSync(file) ? Number(fs.readFileSync(file, "utf8")) : 0) + 1;',
          "  fs.writeFileSync(file, String(runs));",
          "  expect(runs).toBeGreaterThan(1);",
        ].join("\n"),
        'import fs from "node:fs";',
      );
      const configRetries = await makeRepo({
        files: {
          "playwright.config.mjs": "export default { retries: 2 };\n",
          "tests/autoai/cart.spec.ts": counting,
        },
      });
      const first = await runner.runAttempt(request(configRetries), () => undefined);
      expect(first.ok && first.value.result).toBe("failed");
      expect(await readFile(join(configRetries, "tests/autoai/runs.txt"), "utf8")).toBe("1");

      const specRetries = await makeRepo({
        files: {
          "tests/autoai/cart.spec.ts": counting.replace(
            'test("cart',
            'test.describe.configure({ retries: 1 });\ntest("cart',
          ),
        },
      });
      const second = await runner.runAttempt(request(specRetries), () => undefined);
      expect(await readFile(join(specRetries, "tests/autoai/runs.txt"), "utf8")).toBe("2");
      expect(second.ok && second.value.result).toBe("failed");
      // The steps are the first try's only: the passing in-spec retry adds none.
      const names = (r: typeof first) =>
        r.ok ? r.value.steps.map((s) => `${s.status} ${s.step}`) : [];
      expect(names(second)).toStrictEqual(names(first));
      expect(names(second).filter((n) => n.startsWith("failed"))).toHaveLength(1);
    });

    it("ignores other output, including lines that imitate the reporter", async () => {
      const root = await makeRepo({
        files: {
          "playwright.config.mjs": `console.log("AUTOAI:{broken");\nconsole.log('AUTOAI:{"kind":"test"}');\n${CONFIG}`,
          "tests/autoai/cart.spec.ts": passing.replace(
            "await page",
            'console.log("noise");\n  await page',
          ),
        },
      });
      const result = await runner.runAttempt(request(root), () => undefined);
      expect(result.ok && result.value.result).toBe("passed");
    });

    it("starts the app with the user's webServer and baseURL, relative to their config", async () => {
      const port = await freePort();
      const server = [
        'import { createServer } from "node:http";',
        `createServer((_q, s) => s.end("<h1>Sample Shop</h1>")).listen(${String(port)});`,
      ].join("\n");
      const root = await makeRepo({
        files: {
          "app/server.mjs": server,
          "playwright.config.mjs": `export default { use: { baseURL: "http://localhost:${String(port)}" }, webServer: { command: "node app/server.mjs", url: "http://localhost:${String(port)}" } };\n`,
          "tests/autoai/cart.spec.ts": [
            'import { expect, test } from "@playwright/test";',
            'test("home", async ({ page }) => {',
            '  await page.goto("/?token=secret-123#frag");',
            '  await expect(page.getByRole("heading")).toHaveText("Sample Shop");',
            "});",
          ].join("\n"),
        },
      });
      const result = await runner.runAttempt(request(root), () => undefined);
      expect(result.ok ? result.value.result : result.error).toBe("passed");
      // A token in a URL never ends up in a step name (logged, stored, later sent for diagnosis).
      const names = result.ok ? result.value.steps.map((e) => e.step) : [];
      expect(names).toContain("Navigate /");
      expect(names.join("\n")).not.toContain("secret-123");
    });

    it("keeps each attempt's screenshot in its own folder", async () => {
      const root = await makeRepo({ files: { "tests/autoai/cart.spec.ts": failing } });
      const runId = RunId.parse("run-attempts");
      const shots: string[] = [];
      for (const attempt of [1, 2]) {
        const r = await runner.runAttempt(request(root, { runId, attempt }), () => undefined);
        if (r.ok && r.value.result === "failed") shots.push(r.value.failure.screenshotPath ?? "");
      }
      expect(shots).toHaveLength(2);
      expect(shots.every((s) => existsSync(s))).toBe(true);
      expect(shots[1]).toContain("attempt-2");
    });

    it.each<[string, RepoSetup, Partial<AttemptRequest>, string]>([
      [
        "a skipped test",
        { files: { "tests/autoai/cart.spec.ts": passing.replace("test(", "test.skip(") } },
        {},
        "TEST_SKIPPED",
      ],
      [
        "a config that throws",
        {
          files: {
            "playwright.config.mjs": 'throw new Error("bad config");\n',
            "tests/autoai/cart.spec.ts": passing,
          },
        },
        {},
        "RUN_CRASHED",
      ],
      [
        "no Playwright in the repo",
        { install: false, files: { "tests/autoai/cart.spec.ts": passing } },
        {},
        "PLAYWRIGHT_NOT_INSTALLED",
      ],
      [
        "no playwright.config",
        { files: { "playwright.config.mjs": null, "tests/autoai/cart.spec.ts": passing } },
        {},
        "PLAYWRIGHT_CONFIG_MISSING",
      ],
      ["a missing spec", {}, {}, "SPEC_NOT_FOUND"],
      [
        "a spec outside tests/autoai",
        { files: { "tests/cart.spec.ts": passing } },
        { specPath: "tests/cart.spec.ts" },
        "PATH_NOT_ALLOWED",
      ],
      [
        "a path climbing out",
        {},
        { specPath: "tests/autoai/../../cart.spec.ts" },
        "PATH_NOT_ALLOWED",
      ],
    ])("%s -> %s", async (_name, setup, over, code) => {
      const root = await makeRepo(setup);
      const result = await runner.runAttempt(request(root, over), () => undefined);
      expect(result.ok ? result.value.result : result.error.code).toBe(code);
    });

    it("a missing repo -> REPO_NOT_FOUND", async () => {
      const result = await runner.runAttempt(request("/no/such/repo"), () => undefined);
      expect(result.ok || result.error.code).toBe("REPO_NOT_FOUND");
    });

    it.each([
      ["a symlinked tests/autoai", "tests/autoai"],
      ["a symlinked spec file", "tests/autoai/cart.spec.ts"],
    ])("refuses %s -> PATH_NOT_ALLOWED", async (_name, linked) => {
      const outside = await makeRepo({ files: { "tests/autoai/cart.spec.ts": passing } });
      const root = await makeRepo({ files: { "tests/.keep": "" } });
      if (linked === "tests/autoai/cart.spec.ts") await mkdir(join(root, "tests/autoai"));
      await symlink(join(outside, linked), join(root, linked));
      const result = await runner.runAttempt(request(root), () => undefined);
      expect(result.ok || result.error.code).toBe("PATH_NOT_ALLOWED");
    });

    it("a browser that was never downloaded -> BROWSER_NOT_INSTALLED", async () => {
      const root = await makeRepo({ files: { "tests/autoai/cart.spec.ts": passing } });
      const emptyBrowsers = await mkdtemp(join(tmpdir(), "autoai-no-browsers-"));
      const noBrowser = createPlaywrightTestRunner({
        artifactsDir,
        env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: emptyBrowsers },
      });
      const result = await noBrowser.runAttempt(request(root), () => undefined);
      expect(result.ok || result.error).toMatchObject({
        code: "BROWSER_NOT_INSTALLED",
        message: expect.stringContaining("npx playwright install chromium") as unknown,
      });
    });

    it("never passes AutoAI's Anthropic key to the user's config, server or tests", async () => {
      const root = await makeRepo({
        files: {
          "playwright.config.mjs": `if (process.env.ANTHROPIC_API_KEY) throw new Error("key leaked to config");\n${CONFIG}`,
          "tests/autoai/cart.spec.ts": spec(
            '  expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();\n  expect(process.env.ANTHROPIC_BASE_URL).toBeUndefined();\n  expect(process.env.AUTOAI_KEEP).toBe("yes");',
          ),
        },
      });
      const withKey = createPlaywrightTestRunner({
        artifactsDir,
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: "sk-ant-test",
          ANTHROPIC_BASE_URL: "https://x",
          AUTOAI_KEEP: "yes",
        },
      });
      const result = await withKey.runAttempt(request(root), () => undefined);
      expect(result.ok ? result.value.result : result.error).toBe("passed");
    });

    it("Playwright that cannot be started -> RUN_CRASHED, not a thrown error", async () => {
      const root = await makeRepo({ files: { "tests/autoai/cart.spec.ts": passing } });
      const noNode = createPlaywrightTestRunner({ artifactsDir, nodePath: "/no/such/node" });
      const result = await noNode.runAttempt(request(root), () => undefined);
      expect(result.ok || result.error).toMatchObject({
        code: "RUN_CRASHED",
        message: expect.stringContaining("could not be started") as unknown,
      });
    });

    it("stops an attempt that runs past its time limit -> RUN_TIMED_OUT", async () => {
      // A global setup that never finishes, like a dev server that never comes up.
      const root = await makeRepo({
        files: {
          "setup.mjs": "export default () => new Promise(() => setInterval(() => {}, 1000));\n",
          "playwright.config.mjs": 'export default { globalSetup: "./setup.mjs" };\n',
          "tests/autoai/cart.spec.ts": passing,
        },
      });
      const started = Date.now();
      const result = await runner.runAttempt(request(root, { timeLimitMs: 2000 }), () => undefined);
      expect(result.ok || result.error.code).toBe("RUN_TIMED_OUT");
      expect(Date.now() - started).toBeLessThan(15_000);
    });

    it("treats a run id that is not a plain folder name as a runner bug", async () => {
      const root = await makeRepo({ files: { "tests/autoai/cart.spec.ts": passing } });
      await expect(
        runner.runAttempt(request(root, { runId: RunId.parse("../escape") }), () => undefined),
      ).rejects.toThrow(/runner bug/);
    });
  },
);

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, () => {
      const address = probe.address();
      probe.close(() => {
        if (address !== null && typeof address === "object") resolve(address.port);
        else reject(new Error("no port"));
      });
    });
  });
}

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { StepEvent } from "../../core/domain/step.ts";
import type { TestRunner } from "../../core/ports/test-runner.ts";
import { GENERATED_TEST_DIR } from "../../core/rules/generated-test.ts";
import { attemptReportOf, type FinishedRun } from "./attempt-report.ts";
import { type LocatedSpec, locateSpec } from "./locate-spec.ts";
import { lineSplitter, parseReporterLine, type ReporterEvent } from "./reporter-events.ts";
import { wrapperConfigSource } from "./wrapper-config.ts";

const REPORTER = fileURLToPath(new URL("./autoai-reporter.mjs", import.meta.url));
// Kept only to explain a crash; Playwright can print a lot.
const STDERR_TAIL_CHARS = 4000;
// After asking Playwright to stop (it then shuts down the browser and the user's webServer), how long to wait
// before killing it outright.
const STOP_GRACE_MS = 5000;
// The run id becomes a folder name under artifactsDir.
const PLAIN_ID = /^[A-Za-z0-9_-]+$/;

export type PlaywrightRunnerOptions = {
  /** AutoAI's own folder for screenshots and snapshots (never the user's repo). */
  readonly artifactsDir: string;
  /** The environment Playwright runs with; tests pass e.g. an empty browsers folder. */
  readonly env?: NodeJS.ProcessEnv;
  /** The Node binary that starts Playwright. Defaults to the one running AutoAI (see BUILD-LOG for Electron). */
  readonly nodePath?: string;
};

type StepFields = Omit<StepEvent, "runId" | "attempt">;

/** TestRunner that runs the repo's own Playwright with AutoAI's wrapper config and reporter (ADR 0005). */
export function createPlaywrightTestRunner(options: PlaywrightRunnerOptions): TestRunner {
  return {
    async runAttempt(request, onStep) {
      const located = await locateSpec(request);
      if (!located.ok) return located;
      if (!PLAIN_ID.test(request.runId)) {
        throw new Error(`runner bug: run id "${request.runId}" is not a plain folder name`);
      }
      // One folder per attempt: Playwright empties its output folder at start, which would delete attempt 1's
      // screenshot during the retry.
      const outputDir = join(
        options.artifactsDir,
        request.runId,
        `attempt-${String(request.attempt)}`,
      );
      await mkdir(outputDir, { recursive: true });

      const steps: StepEvent[] = [];
      const tempDir = await mkdtemp(join(tmpdir(), "autoai-run-"));
      try {
        const config = join(tempDir, "autoai.playwright.config.mjs");
        await writeFile(
          config,
          wrapperConfigSource({
            userConfig: located.value.config,
            testDir: join(located.value.root, GENERATED_TEST_DIR),
            specFile: located.value.specFile,
            outputDir,
            reporter: REPORTER,
          }),
        );
        const env = withoutAutoAiSecrets(options.env ?? process.env);
        const node = options.nodePath ?? process.execPath;
        const run = await runPlaywright(
          located.value,
          config,
          { node, env, timeLimitMs: request.timeLimitMs },
          (s) => {
            const event: StepEvent = { ...s, runId: request.runId, attempt: request.attempt };
            steps.push(event);
            onStep(event);
          },
        );
        return await attemptReportOf({ ...run, steps });
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    },
  };
}

function runPlaywright(
  located: LocatedSpec,
  config: string,
  start: { readonly node: string; readonly env: NodeJS.ProcessEnv; readonly timeLimitMs: number },
  onStep: (step: StepFields) => void,
): Promise<Omit<FinishedRun, "steps">> {
  const tests: Extract<ReporterEvent, { kind: "test" }>[] = [];
  const errors: string[] = [];
  let stderr = "";
  const lines = lineSplitter((line) => {
    const event = parseReporterLine(line);
    if (event === null) return;
    if (event.kind === "error") {
      errors.push(event.message);
      return;
    }
    // A retry configured inside the spec is not an AutoAI attempt: only Playwright's first try counts.
    if (event.retry > 0) return;
    if (event.kind === "test") tests.push(event);
    else
      onStep({
        step: event.step,
        status: event.status,
        durationMs: event.durationMs,
        ts: event.ts,
      });
  });

  return new Promise((resolve) => {
    const child = spawn(start.node, [located.cli, "test", "--config", config], {
      cwd: located.root,
      env: { ...start.env, FORCE_COLOR: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      lines.push(chunk);
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-STDERR_TAIL_CHARS);
    });
    // The time limit (core/rules/run-time-limit.ts): ask Playwright to stop, then kill it if it doesn't.
    let timedOutAfterMs: number | null = null;
    let kill: NodeJS.Timeout | undefined;
    const stop = setTimeout(() => {
      // A test that finished just as the limit hit keeps its real result: only a still-running process times out.
      if (child.exitCode !== null || child.signalCode !== null) return;
      timedOutAfterMs = start.timeLimitMs;
      child.kill("SIGINT");
      kill = setTimeout(() => child.kill("SIGKILL"), STOP_GRACE_MS);
    }, start.timeLimitMs);
    const finish = (signal: NodeJS.Signals | null, spawnError: string | null): void => {
      clearTimeout(stop);
      clearTimeout(kill);
      resolve({ tests, errors, stderr, signal, spawnError, timedOutAfterMs });
    };
    // A failed start emits "error" and may also emit "close": the first one settles the run.
    child.on("error", (e) => {
      finish(null, e.message);
    });
    child.on("close", (_code, signal) => {
      lines.end();
      finish(signal, null);
    });
  });
}

// The user's config, server and app code run in this process: AutoAI's own key must never reach them (PRD §19,
// BYOK: the key goes only to api.anthropic.com).
function withoutAutoAiSecrets(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([name]) => !name.startsWith("ANTHROPIC_")));
}

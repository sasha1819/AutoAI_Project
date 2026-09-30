import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { RunId } from "../core/domain/ids.ts";
import { isRunFailure } from "../core/rules/run-status.ts";
import { parseCliArgs, timeStamp } from "./cli-args.ts";
import { composeCli } from "./compose.ts";
import { formatAttemptStart, formatRun, formatRunError, formatStepLine } from "./format-run.ts";
import { writeJsonFile } from "./output.ts";

const USAGE = [
  "Usage: npm run run-test -- --repo <folder> --spec tests/autoai/<file>.spec.ts [--artifacts <folder>] [--out <file.json>] [--json]",
  "  Runs the spec with the repo's own Playwright (Chromium); a failure is retried once. No AI is used.",
  "  --artifacts is where screenshots and page snapshots go (default: a folder in the OS temp dir).",
].join("\n");
const Args = z.object({
  repo: z.string().min(1),
  spec: z.string().min(1),
  artifacts: z.string().min(1).optional(),
  out: z.string().min(1).optional(),
  json: z.boolean(),
});

const OPTIONS = {
  repo: { type: "string" },
  spec: { type: "string" },
  artifacts: { type: "string" },
  out: { type: "string" },
  json: { type: "boolean", default: false },
} as const;

async function main(): Promise<number> {
  const args = parseCliArgs(process.argv.slice(2), OPTIONS, Args);
  if (args === null) {
    console.error(USAGE);
    return 2;
  }
  const runId = RunId.parse(`run-${timeStamp(new Date())}`);
  const artifactsDir = args.artifacts ?? join(tmpdir(), "autoai-runs");
  // The live log goes to stderr with --json, so stdout stays one JSON document.
  const log = args.json ? console.error : console.log;
  let lastAttempt = 0;

  const result = await composeCli().runTest(
    { repoRoot: args.repo, specPath: args.spec, runId },
    (event) => {
      if (event.attempt !== lastAttempt) {
        lastAttempt = event.attempt;
        log(formatAttemptStart(event.attempt));
      }
      const line = formatStepLine(event);
      if (line !== null) log(line);
    },
    artifactsDir,
  );
  const value = result.ok ? result.value : result.error;
  const outProblem = args.out === undefined ? null : await writeJsonFile(args.out, value);
  if (outProblem) console.error(outProblem);

  if (args.json) console.log(JSON.stringify(value, null, 2));
  else if (result.ok) console.log(`\n${formatRun(result.value)}`);
  else console.error(`\n${formatRunError(result.error)}`);
  // A flaky run is not a failure (it is shown plainly above); a failed run or a run that couldn't finish is.
  const failed = !result.ok || isRunFailure(result.value.status);
  return failed || outProblem ? 1 : 0;
}

process.exitCode = await main();

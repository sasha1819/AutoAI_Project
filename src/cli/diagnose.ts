import { z } from "zod";
import { Finding } from "../core/domain/finding.ts";
import { Run } from "../core/domain/run.ts";
import { KEY_HELP, readAiOptions } from "./ai-options.ts";
import { parseCliArgs, timeStamp } from "./cli-args.ts";
import { composeCli } from "./compose.ts";
import { notRecordedLine } from "./staged-recording.ts";
import { errorLine, runCostUsd } from "./format-ai.ts";
import { formatDiagnosis } from "./format-diagnosis.ts";
import { readJsonFile } from "./json-file.ts";
import { writeJsonFile } from "./output.ts";

const USAGE = [
  "Usage: npm run diagnose -- --run <run.json> [--from <scan-result.json>] [--out <file.json>] [--model <id>] [--effort low|medium|high] [--record <folder>] [--json]",
  "  --run is a saved `npm run run-test --out` result; only a confirmed failure is diagnosed.",
  "  Secrets (tokens, passwords, cookies, auth headers) are hidden before anything is sent to Claude.",
  "  --record saves the prompt as sent (already redacted, but with your test, app code, error and page snapshot) and Claude's answer to that folder.",
].join("\n");
const Args = z.object({
  run: z.string().min(1),
  from: z.string().min(1).optional(),
  out: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  effort: z.enum(["low", "medium", "high"]).optional(),
  record: z.string().min(1).optional(),
  json: z.boolean(),
});
const OPTIONS = {
  run: { type: "string" },
  from: { type: "string" },
  out: { type: "string" },
  model: { type: "string" },
  effort: { type: "string" },
  record: { type: "string" },
  json: { type: "boolean", default: false },
} as const;
// Only the findings of a saved `npm run scan --out` result are needed; the rest of that file is ignored.
const ScanFile = z.object({ findings: z.array(Finding) });

async function main(): Promise<number> {
  const args = parseCliArgs(process.argv.slice(2), OPTIONS, Args);
  if (args === null) {
    console.error(USAGE);
    return 2;
  }
  const ai = readAiOptions(process.env, { model: args.model, effort: args.effort });
  if (ai === null) {
    console.error(KEY_HELP);
    return 2;
  }
  const run = await readJsonFile(args.run, Run, { code: "INVALID_RUN_FILE", what: "a saved run" });
  if (typeof run === "string") {
    console.error(run);
    return 1;
  }
  const scan =
    args.from === undefined
      ? { findings: [] }
      : await readJsonFile(args.from, ScanFile, {
          code: "INVALID_SCAN_FILE",
          what: "a scan result",
        });
  if (typeof scan === "string") {
    console.error(scan);
    return 1;
  }

  const { result, recording } = await composeCli().diagnoseFailure(
    { run, findings: scan.findings },
    ai,
    args.record === undefined ? undefined : { dir: args.record, runId: timeStamp(new Date()) },
  );
  // --record saves only a run that fully succeeded; otherwise say why, after the result (which is paid for).
  const notRecorded =
    recording && !recording.ok
      ? notRecordedLine(`--record ${args.record ?? ""}`, recording.error)
      : null;
  if (!result.ok) {
    console.error(errorLine(result.error));
    if (notRecorded) console.error(notRecorded);
    return 1;
  }
  const outProblem = args.out === undefined ? null : await writeJsonFile(args.out, result.value);
  // The diagnosis is paid for: report a write problem but still print it.
  if (outProblem) console.error(outProblem);
  console.log(
    args.json
      ? JSON.stringify(result.value, null, 2)
      : formatDiagnosis(result.value, runCostUsd([result.value.model], result.value.usage)),
  );
  if (notRecorded) console.error(notRecorded);
  return outProblem || notRecorded ? 1 : 0;
}

process.exitCode = await main();

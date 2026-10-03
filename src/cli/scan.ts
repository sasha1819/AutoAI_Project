import { z } from "zod";
import { KEY_HELP, readAiOptions } from "./ai-options.ts";
import { parseCliArgs, timeStamp } from "./cli-args.ts";
import { composeCli } from "./compose.ts";
import { notRecordedLine } from "./staged-recording.ts";
import { runCostUsd } from "./format-ai.ts";
import { formatScan } from "./format-scan.ts";
import { writeJsonFile } from "./output.ts";

const USAGE = [
  "Usage: npm run scan -- --repo <folder> --prds <folder> [--out <file.json>] [--model <id>] [--effort low|medium|high] [--record <folder>] [--json]",
  "  --record saves each prompt, which contains your source code, and Claude's answer to that folder.",
].join("\n");
const Args = z.object({
  repo: z.string().min(1),
  prds: z.string().min(1),
  out: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  effort: z.enum(["low", "medium", "high"]).optional(),
  record: z.string().min(1).optional(),
  json: z.boolean(),
});

const OPTIONS = {
  repo: { type: "string" },
  prds: { type: "string" },
  out: { type: "string" },
  model: { type: "string" },
  effort: { type: "string" },
  record: { type: "string" },
  json: { type: "boolean", default: false },
} as const;

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

  const { result, recording } = await composeCli().scanProject(
    { repoRoot: args.repo, prdFolder: args.prds },
    ai,
    args.record === undefined ? undefined : { dir: args.record, runId: timeStamp(new Date()) },
  );
  // --record saves only a run that fully succeeded; otherwise say why, after the result (which is paid for).
  const notRecorded =
    recording && !recording.ok
      ? notRecordedLine(`--record ${args.record ?? ""}`, recording.error)
      : null;
  if (!result.ok) {
    console.error(`${result.error.code}: ${result.error.message}`);
    if (notRecorded) console.error(notRecorded);
    return 1;
  }
  const scan = result.value;
  const outProblem = args.out === undefined ? null : await writeJsonFile(args.out, scan);
  // The scan is paid for: report a write problem but still print the result.
  if (outProblem) console.error(outProblem);
  console.log(
    args.json
      ? JSON.stringify(scan, null, 2)
      : formatScan(scan, runCostUsd(scan.models, scan.usage)),
  );
  if (notRecorded) console.error(notRecorded);
  return scan.stoppedBy || outProblem || notRecorded ? 1 : 0;
}

process.exitCode = await main();

import { z } from "zod";
import { Finding } from "../core/domain/finding.ts";
import { KEY_HELP, readAiOptions } from "./ai-options.ts";
import { parseCliArgs } from "./cli-args.ts";
import { composeCli } from "./compose.ts";
import { runCostUsd } from "./format-ai.ts";
import { formatGenerate } from "./format-generate.ts";
import { readJsonFile } from "./json-file.ts";
import { writeJsonFile } from "./output.ts";

const USAGE =
  "Usage: npm run generate-tests -- --repo <folder> --from <scan-result.json> [--out <file.json>] [--model <id>] [--effort low|medium|high] [--json]";

const Args = z.object({
  repo: z.string().min(1),
  from: z.string().min(1),
  out: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  effort: z.enum(["low", "medium", "high"]).optional(),
  json: z.boolean(),
});
// Only the findings of a saved `npm run scan --out` result are needed; the rest of that file is ignored.
const ScanFile = z.object({ findings: z.array(Finding) });

const OPTIONS = {
  repo: { type: "string" },
  from: { type: "string" },
  out: { type: "string" },
  model: { type: "string" },
  effort: { type: "string" },
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
  const scan = await readJsonFile(args.from, ScanFile, {
    code: "INVALID_SCAN_FILE",
    what: "a scan result",
  });
  if (typeof scan === "string") {
    console.error(scan);
    return 1;
  }
  const { findings } = scan;

  const result = await composeCli().generateTests({ repoRoot: args.repo, findings }, ai);
  if (!result.ok) {
    console.error(`${result.error.code}: ${result.error.message}`);
    return 1;
  }
  const generated = result.value;
  const outProblem = args.out === undefined ? null : await writeJsonFile(args.out, generated);
  // Whatever was generated is paid for: report a write problem but still print the result.
  if (outProblem) console.error(outProblem);
  console.log(
    args.json
      ? JSON.stringify(generated, null, 2)
      : formatGenerate(generated, runCostUsd(generated.models, generated.usage)),
  );
  return generated.stoppedBy || outProblem ? 1 : 0;
}

process.exitCode = await main();

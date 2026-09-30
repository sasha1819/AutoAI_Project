import { readFile } from "node:fs/promises";
import { z } from "zod";
import { Finding } from "../core/domain/finding.ts";
import { KEY_HELP, readAiOptions } from "./ai-options.ts";
import { parseCliArgs } from "./cli-args.ts";
import { composeCli } from "./compose.ts";
import { runCostUsd } from "./format-ai.ts";
import { formatGenerate } from "./format-generate.ts";
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

// The scan file is outside data (disk), so it is validated here, at the boundary.
async function readFindings(path: string): Promise<z.infer<typeof ScanFile>["findings"] | string> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (e) {
    return `INVALID_SCAN_FILE: ${path}: ${e instanceof Error ? e.message : String(e)}`;
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return `INVALID_SCAN_FILE: ${path}: not valid JSON (${e instanceof Error ? e.message : String(e)})`;
  }
  const parsed = ScanFile.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return `INVALID_SCAN_FILE: ${path}: not a scan result (${issues})`;
  }
  return parsed.data.findings;
}

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
  const findings = await readFindings(args.from);
  if (typeof findings === "string") {
    console.error(findings);
    return 1;
  }

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

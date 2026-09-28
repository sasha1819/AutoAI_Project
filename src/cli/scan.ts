import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { approximateCostUsd } from "../adapters/claude/pricing.ts";
import { composeCli } from "./compose.ts";
import { formatScan } from "./format-scan.ts";

const USAGE = [
  "Usage: npm run scan -- --repo <folder> --prds <folder> [--out <file.json>] [--model <id>] [--effort low|medium|high] [--record <folder>] [--json]",
  "  --record saves each prompt, which contains your source code, and Claude's answer to that folder.",
].join("\n");
const KEY_HELP =
  "Set ANTHROPIC_API_KEY to your own Anthropic API key. AutoAI is bring-your-own-key: the key, and the code it sends, go only from this machine to api.anthropic.com.";

const Args = z.object({
  repo: z.string().min(1),
  prds: z.string().min(1),
  out: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  effort: z.enum(["low", "medium", "high"]).optional(),
  record: z.string().min(1).optional(),
  json: z.boolean(),
});
const ApiKey = z.string().trim().min(1);
const ModelEnv = z.string().trim().min(1);

function readArgs(argv: string[]): z.infer<typeof Args> | null {
  try {
    const { values } = parseArgs({
      args: argv,
      options: {
        repo: { type: "string" },
        prds: { type: "string" },
        out: { type: "string" },
        model: { type: "string" },
        effort: { type: "string" },
        record: { type: "string" },
        json: { type: "boolean", default: false },
      },
      strict: true,
      allowPositionals: false,
    });
    const parsed = Args.safeParse(values);
    return parsed.success ? parsed.data : null;
  } catch (e) {
    // parseArgs reports bad input by throwing ERR_PARSE_ARGS_*; that is a usage error, anything else is a bug.
    if (e instanceof Error && "code" in e && String(e.code).startsWith("ERR_PARSE_ARGS"))
      return null;
    throw e;
  }
}

async function main(): Promise<number> {
  const args = readArgs(process.argv.slice(2));
  if (args === null) {
    console.error(USAGE);
    return 2;
  }
  const key = ApiKey.safeParse(process.env["ANTHROPIC_API_KEY"]);
  if (!key.success) {
    console.error(KEY_HELP);
    return 2;
  }
  const envModel = ModelEnv.safeParse(process.env["AUTOAI_MODEL"]);
  const model = args.model ?? (envModel.success ? envModel.data : undefined);

  const result = await composeCli().scanProject(
    { repoRoot: args.repo, prdFolder: args.prds },
    {
      apiKey: key.data,
      ...(model === undefined ? {} : { model }),
      ...(args.effort === undefined ? {} : { effort: args.effort }),
    },
    args.record === undefined
      ? undefined
      : { dir: args.record, runId: new Date().toISOString().replace(/[:.]/g, "-") },
  );
  if (!result.ok) {
    console.error(`${result.error.code}: ${result.error.message}`);
    return 1;
  }
  const scan = result.value;
  let outFailed = false;
  if (args.out !== undefined) {
    try {
      await mkdir(dirname(args.out), { recursive: true });
      await writeFile(args.out, `${JSON.stringify(scan, null, 2)}\n`);
    } catch (e) {
      // The scan is paid for: report the write problem but still print the result below.
      console.error(
        `Could not write --out ${args.out}: ${e instanceof Error ? e.message : String(e)}`,
      );
      outFailed = true;
    }
  }
  const [onlyModel] = scan.models;
  const cost =
    scan.models.length === 1 && onlyModel !== undefined
      ? approximateCostUsd(onlyModel, scan.usage)
      : null;
  console.log(args.json ? JSON.stringify(scan, null, 2) : formatScan(scan, cost));
  return scan.stoppedBy || outFailed ? 1 : 0;
}

process.exitCode = await main();

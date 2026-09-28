import { parseArgs } from "node:util";
import { z } from "zod";
import { composeCli } from "./compose.ts";
import { formatRequirements } from "./format-requirements.ts";

const USAGE = "Usage: npm run requirements -- --prds <folder> [--json]";
const Args = z.object({ prds: z.string().min(1), json: z.boolean() });

function readArgs(argv: string[]): z.infer<typeof Args> | null {
  try {
    const { values } = parseArgs({
      args: argv,
      options: { prds: { type: "string" }, json: { type: "boolean", default: false } },
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

const args = readArgs(process.argv.slice(2));
if (args === null) {
  console.error(USAGE);
  process.exitCode = 2;
} else {
  const result = await composeCli().extractRequirements({ prdFolder: args.prds });
  if (!result.ok) {
    console.error(`${result.error.code}: ${result.error.message}`);
    process.exitCode = 1;
  } else {
    console.log(
      args.json
        ? JSON.stringify(result.value, null, 2)
        : formatRequirements(args.prds, result.value),
    );
  }
}

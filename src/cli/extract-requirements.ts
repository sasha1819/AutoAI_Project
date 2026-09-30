import { z } from "zod";
import { parseCliArgs } from "./cli-args.ts";
import { composeCli } from "./compose.ts";
import { formatRequirements } from "./format-requirements.ts";

const USAGE = "Usage: npm run requirements -- --prds <folder> [--json]";
const Args = z.object({ prds: z.string().min(1), json: z.boolean() });

const OPTIONS = { prds: { type: "string" }, json: { type: "boolean", default: false } } as const;

const args = parseCliArgs(process.argv.slice(2), OPTIONS, Args);
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

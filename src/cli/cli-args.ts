import { parseArgs, type ParseArgsOptionsConfig } from "node:util";
import type { z } from "zod";

/**
 * Reads a command's options, then validates them with its schema. Returns null for anything the user typed wrong
 * (an unknown option, a missing or invalid value), so the command prints its usage; anything else is a bug.
 */
export function parseCliArgs<S extends z.ZodType>(
  argv: readonly string[],
  options: ParseArgsOptionsConfig,
  schema: S,
): z.infer<S> | null {
  try {
    const { values } = parseArgs({
      args: [...argv],
      options,
      strict: true,
      allowPositionals: false,
    });
    const parsed = schema.safeParse(values);
    return parsed.success ? parsed.data : null;
  } catch (e) {
    // parseArgs reports bad input by throwing ERR_PARSE_ARGS_*; that is a usage error, anything else is a bug.
    if (e instanceof Error && "code" in e && String(e.code).startsWith("ERR_PARSE_ARGS"))
      return null;
    throw e;
  }
}

/** A sortable, file-name-safe stamp for ids and folder names, e.g. "2026-09-30T19-26-09-396Z". */
export function timeStamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

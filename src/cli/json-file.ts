import { readFile } from "node:fs/promises";
import type { z } from "zod";

/**
 * Reads a JSON file a command was given (a saved scan result, a saved run) and validates it, since it is outside
 * data. Returns the data, or a "CODE: path: reason" message for the terminal.
 */
export async function readJsonFile<S extends z.ZodType>(
  path: string,
  schema: S,
  expected: { readonly code: string; readonly what: string },
): Promise<z.infer<S> | string> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (e) {
    return `${expected.code}: ${path}: ${e instanceof Error ? e.message : String(e)}`;
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return `${expected.code}: ${path}: not valid JSON (${e instanceof Error ? e.message : String(e)})`;
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return `${expected.code}: ${path}: not ${expected.what} (${issues})`;
  }
  return parsed.data;
}

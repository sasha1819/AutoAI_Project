import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Writes a result as pretty JSON. Returns a message instead of throwing when it cannot, so the caller can still
 * print a result the user already paid for.
 */
export async function writeJsonFile(path: string, value: unknown): Promise<string | null> {
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
    return null;
  } catch (e) {
    return `Could not write --out ${path}: ${e instanceof Error ? e.message : String(e)}`;
  }
}

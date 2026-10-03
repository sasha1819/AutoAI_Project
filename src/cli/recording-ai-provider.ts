import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AiProvider } from "../core/ports/ai-provider.ts";

/**
 * Wraps an AiProvider and saves every request with its result to `<dir>/<runId>-<n>.json` (ADR 0002: real
 * recordings for the parser tests); the API key is never part of a request. It saves failed calls too, so use it only
 * through recordRun (staged-recording.ts), which records into a temporary folder and keeps only fully successful runs.
 */
export function recordingAiProvider(inner: AiProvider, dir: string, runId: string): AiProvider {
  let calls = 0;
  return {
    // Key checks carry no prompt, so there is nothing to record.
    verifyAccess: () => inner.verifyAccess(),
    async complete(request) {
      const result = await inner.complete(request);
      calls += 1;
      const file = join(dir, `${runId}-${String(calls)}.json`);
      try {
        await mkdir(dir, { recursive: true });
        await writeFile(file, `${JSON.stringify({ request, result }, null, 2)}\n`);
      } catch (e) {
        // Recording is optional: a write problem must never lose an answer the user already paid for.
        console.error(`Could not record ${file}: ${e instanceof Error ? e.message : String(e)}`);
      }
      return result;
    },
  };
}

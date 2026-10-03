import { err, ok, type Result } from "../core/domain/result.ts";
import type { AiProvider } from "../core/ports/ai-provider.ts";
import type { RepoReader } from "../core/ports/repo-reader.ts";
import { type AiTally, newAiTally } from "../services/ask-ai.ts";
import { type ExtractedWithAi, extractWithAi } from "../services/extract-with-ai.ts";
import { recordRun } from "./staged-recording.ts";

/**
 * Records Claude's extraction of one plain-prose PRD for the replay test (scripts/record-extractions.mjs), through
 * the shared rule (recordRun): saved only when the whole case succeeded, otherwise the folder is left as it was.
 */
export async function recordExtraction(
  deps: { readonly aiProvider: AiProvider; readonly repoReader: RepoReader },
  input: {
    readonly prdFolder: string;
    readonly file: string;
    readonly recordingsDir: string;
    readonly name: string;
  },
): Promise<Result<{ readonly extracted: ExtractedWithAi; readonly tally: AiTally }>> {
  const tally = newAiTally();
  const run = await recordRun({
    inner: deps.aiProvider,
    dir: input.recordingsDir,
    name: input.name,
    run: (aiProvider) =>
      extractWithAi(
        { repoReader: deps.repoReader, aiProvider },
        { prdFolder: input.prdFolder, files: [input.file], tally, onProgress: () => undefined },
      ),
    // An AI error that stopped it, an answer that stayed invalid, or an unreadable file: not a recording.
    failureOf: (extracted) => extracted.stoppedBy ?? extracted.warnings[0] ?? null,
  });
  return run.recording.ok ? ok({ extracted: run.value, tally }) : err(run.recording.error);
}

import { copyFile, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DomainError } from "../core/domain/domain-error.ts";
import { err, ok, type Result } from "../core/domain/result.ts";
import type { AiError, AiProvider } from "../core/ports/ai-provider.ts";
import type { RepoReader } from "../core/ports/repo-reader.ts";
import { type AiTally, newAiTally } from "../services/ask-ai.ts";
import { type ExtractedWithAi, extractWithAi } from "../services/extract-with-ai.ts";
import { recordingAiProvider } from "./recording-ai-provider.ts";

/** An AI error that stopped the call, or the file could not be read or answered validly. */
export type RecordExtractionError = AiError | DomainError<"EXTRACTION_FAILED">;

/**
 * Records Claude's extraction of one plain-prose PRD for the replay test (scripts/record-extractions.mjs). Calls are
 * recorded into a temporary folder and moved into `recordingsDir` only when the whole case succeeded; on any failure
 * (an AI error, an answer that stayed invalid, an unreadable file) the folder is left exactly as it was, so a failed
 * call can never be saved as a recording.
 */
export async function recordExtraction(
  deps: { readonly aiProvider: AiProvider; readonly repoReader: RepoReader },
  input: {
    readonly prdFolder: string;
    readonly file: string;
    readonly recordingsDir: string;
    readonly name: string;
  },
): Promise<
  Result<{ readonly extracted: ExtractedWithAi; readonly tally: AiTally }, RecordExtractionError>
> {
  const staging = await mkdtemp(join(tmpdir(), "autoai-record-extraction-"));
  try {
    const tally = newAiTally();
    const extracted = await extractWithAi(
      {
        repoReader: deps.repoReader,
        aiProvider: recordingAiProvider(deps.aiProvider, staging, input.name),
      },
      { prdFolder: input.prdFolder, files: [input.file], tally, onProgress: () => undefined },
    );
    if (extracted.stoppedBy) return err(extracted.stoppedBy);
    const failed = extracted.warnings[0];
    if (failed) return err({ code: failed.code, message: failed.message });

    // Success: replace this case's old recordings with the new ones.
    const isCase = (f: string) => f.startsWith(`${input.name}-`) && f.endsWith(".json");
    const old = await readdir(input.recordingsDir).catch(() => []);
    for (const f of old.filter(isCase)) await rm(join(input.recordingsDir, f));
    await mkdir(input.recordingsDir, { recursive: true });
    // Copied, not renamed: the staging folder may be on another disk.
    for (const f of (await readdir(staging)).filter(isCase))
      await copyFile(join(staging, f), join(input.recordingsDir, f));
    return ok({ extracted, tally });
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

import { z } from "zod";
import { Finding } from "../core/domain/finding.ts";
import { Requirement, RequirementCandidate } from "../core/domain/requirement.ts";
import { ScanProgress } from "../core/domain/scan-progress.ts";
import {
  AI_CODES,
  FOLDER_CODES,
  REPO_READ_CODES,
  SCAN_WARNING_CODES,
  SECRET_STORE_CODES,
} from "./codes.ts";
import { resultSchema } from "./result.ts";

// Scan: one call that answers when the scan is done, with progress pushed on scan:progress meanwhile.

export const ScanReport = z.strictObject({
  prdFiles: z.array(z.string()).readonly(),
  sourceFiles: z.number().int().nonnegative(),
  requirements: z.array(Requirement).readonly(),
  /** Found by Claude in a plain-prose PRD but not confident enough: not compared, for the user's review (ADR 0008). */
  needsReview: z.array(RequirementCandidate).readonly(),
  extraction: z.strictObject({
    files: z.number().int().nonnegative(),
    dropped: z.number().int().nonnegative(),
  }),
  findings: z.array(Finding).readonly(),
  notScanned: z.array(Requirement).readonly(),
  warnings: z
    .array(z.strictObject({ code: z.enum(SCAN_WARNING_CODES), message: z.string() }))
    .readonly(),
  /** The AI error that stopped the scan early (findings before it are kept): AI failures arrive here, not as an error reply. */
  stoppedBy: z.strictObject({ code: z.enum(AI_CODES), message: z.string() }).nullable(),
  models: z.array(z.string()).readonly(),
  usage: z.strictObject({
    aiCalls: z.number().int().nonnegative(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
  }),
});
export type ScanReport = z.infer<typeof ScanReport>;

export const scanRun = {
  /**
   * Folders the user picked (anything else is FOLDER_NOT_PICKED). prdFolder null: the project has no PRDs (PRD
   * Flow 1 edge case); the scan then has nothing to compare.
   */
  request: z.strictObject({ repoRoot: z.string().min(1), prdFolder: z.string().min(1).nullable() }),
  response: resultSchema(ScanReport, [
    "NO_KEY",
    "SCAN_BUSY",
    ...FOLDER_CODES,
    ...REPO_READ_CODES,
    ...SECRET_STORE_CODES,
  ]),
};

/** Pushed from main while scan:run is working. */
export const ScanProgressEvent = z.strictObject({ progress: ScanProgress });
export type ScanProgressEvent = z.infer<typeof ScanProgressEvent>;

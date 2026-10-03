import { z } from "zod";
import { ClaudeReads } from "../core/domain/claude-reads.ts";
import { FOLDER_CODES, PRD_READ_CODES } from "./codes.ts";
import { resultSchema } from "./result.ts";

// Add project: the user picks folders with the system dialog in main; the screen only gets the chosen path.

export const projectPickFolder = {
  /** What the folder is for: only the dialog's title and button change. */
  request: z.strictObject({ purpose: z.enum(["repo", "prds"]) }),
  /** null when the user cancelled. */
  response: z.strictObject({ path: z.string().min(1).nullable() }),
};

/** What a chosen PRD folder holds, before any scan: parsing only, no AI (so 0 requirements shows before paying). */
export const PrdSummary = z.strictObject({
  files: z
    .array(
      z.strictObject({
        file: z.string().min(1),
        requirements: z.number().int().nonnegative(),
        chars: z.number().int().nonnegative(),
        /** Whether Claude reads this file during the scan (ADR 0008): it parsed to 0 and fits the size cap. */
        claude: ClaudeReads,
      }),
    )
    .readonly(),
  requirements: z.number().int().nonnegative(),
  /** The size cap for a file Claude reads (core/rules/extraction), so the screen can say it. */
  maxChars: z.number().int().positive(),
  /** Extra Claude calls the scan plans for reading the prose PRDs (one per file; a retry only if an answer is invalid). */
  extraCalls: z.number().int().nonnegative(),
});
export type PrdSummary = z.infer<typeof PrdSummary>;

export const projectReadPrds = {
  /** A folder the user picked for PRDs (anything else is FOLDER_NOT_PICKED). */
  request: z.strictObject({ prdFolder: z.string().min(1) }),
  response: resultSchema(PrdSummary, [...PRD_READ_CODES, ...FOLDER_CODES]),
};

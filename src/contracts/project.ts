import { z } from "zod";
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
      z.strictObject({ file: z.string().min(1), requirements: z.number().int().nonnegative() }),
    )
    .readonly(),
  requirements: z.number().int().nonnegative(),
});
export type PrdSummary = z.infer<typeof PrdSummary>;

export const projectReadPrds = {
  /** A folder the user picked for PRDs (anything else is FOLDER_NOT_PICKED). */
  request: z.strictObject({ prdFolder: z.string().min(1) }),
  response: resultSchema(PrdSummary, [...PRD_READ_CODES, ...FOLDER_CODES]),
};

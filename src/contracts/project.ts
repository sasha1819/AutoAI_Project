import { z } from "zod";

// Add project: the user picks folders with the system dialog in main; the screen only gets the chosen path.

export const projectPickFolder = {
  /** What the folder is for: only the dialog's title and button change. */
  request: z.strictObject({ purpose: z.enum(["repo", "prds"]) }),
  /** null when the user cancelled. */
  response: z.strictObject({ path: z.string().min(1).nullable() }),
};

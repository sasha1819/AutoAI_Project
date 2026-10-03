import { z } from "zod";

/** What happens to a PRD file during a scan (ADR 0008): parsed as written, read by Claude, or too large for Claude. */
export const ClaudeReads = z.enum(["not_needed", "will_read", "too_large"]);
export type ClaudeReads = z.infer<typeof ClaudeReads>;

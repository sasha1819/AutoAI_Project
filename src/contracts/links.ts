import { z } from "zod";
import { resultSchema } from "./result.ts";

/**
 * The only addresses the app may open, in the user's default browser (never in the app window: ADR 0007). Exact
 * strings, so a look-alike host, another path or another scheme is refused by the schema itself.
 */
export const ANTHROPIC_CONSOLE = "https://console.anthropic.com/";
export const EXTERNAL_LINKS = [ANTHROPIC_CONSOLE] as const;
export type ExternalLink = (typeof EXTERNAL_LINKS)[number];

export const linkOpen = {
  request: z.strictObject({ url: z.enum(EXTERNAL_LINKS) }),
  response: resultSchema(z.strictObject({ opened: z.literal(true) }), ["LINK_NOT_OPENED"]),
};

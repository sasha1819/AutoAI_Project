import { z } from "zod";

/**
 * Every reply over IPC is a Result (ADR 0007): the value, or an expected failure with a code from the channel's
 * closed list. A code outside the list fails validation, so the screen never meets an error it does not know.
 */
export function resultSchema<V extends z.ZodType, C extends readonly [string, ...string[]]>(
  value: V,
  codes: C,
) {
  return z.discriminatedUnion("ok", [
    z.strictObject({ ok: z.literal(true), value }),
    z.strictObject({
      ok: z.literal(false),
      error: z.strictObject({ code: z.enum(codes), message: z.string() }),
    }),
  ]);
}

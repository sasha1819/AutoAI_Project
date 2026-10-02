import { z } from "zod";
import { AI_CODES, SECRET_STORE_CODES } from "./codes.ts";
import { resultSchema } from "./result.ts";

// Connect AI (ADR 0007). The key goes in once, on save, and is saved only once the provider accepts it; no reply
// ever carries it back. "configured" therefore means a key that worked when it was saved.

export const aiStatus = {
  request: z.strictObject({}),
  response: resultSchema(z.strictObject({ configured: z.boolean() }), SECRET_STORE_CODES),
};

export const aiSaveKey = {
  // The raw text the user typed; its shape is checked in core (ApiKey), the reply says KEY_INVALID.
  request: z.strictObject({ key: z.string().max(4096) }),
  response: resultSchema(z.strictObject({ saved: z.literal(true) }), [
    "KEY_INVALID",
    ...AI_CODES,
    ...SECRET_STORE_CODES,
  ]),
};

export const aiCheckKey = {
  request: z.strictObject({}),
  response: resultSchema(z.strictObject({ works: z.literal(true) }), [
    "NO_KEY",
    ...AI_CODES,
    ...SECRET_STORE_CODES,
  ]),
};

import { z } from "zod";

// Branded, so a key typed into a screen must pass this schema before it can be saved or used. Only its shape is
// checked here (one non-blank token); whether Anthropic accepts it is AiProvider.verifyAccess's job.
export const ApiKey = z
  .string()
  .trim()
  .min(1, "the API key is empty")
  .max(512, "that is too long to be an API key")
  .regex(/^\S+$/, "an API key has no spaces")
  .brand<"ApiKey">();
export type ApiKey = z.infer<typeof ApiKey>;

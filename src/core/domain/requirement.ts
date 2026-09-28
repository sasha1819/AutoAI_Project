import { z } from "zod";

export const Requirement = z
  .object({
    // "Cart 2.4" for a tagged item; the heading title for a heading section. Not unique across or within files.
    tag: z.string().min(1),
    area: z.string().min(1),
    text: z.string().min(1),
    source: z.object({ file: z.string().min(1), line: z.number().int().positive() }).readonly(),
  })
  .readonly();
export type Requirement = z.infer<typeof Requirement>;

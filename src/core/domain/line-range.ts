import { z } from "zod";

const lineNumber = z.number().int().positive();

/** [start, end] lines of a file, 1-based, start <= end: what evidence and quotes cite. */
export const LineRange = z
  .tuple([lineNumber, lineNumber])
  .readonly()
  .refine(([start, end]) => start <= end, "lines must be [start, end] with start <= end");
export type LineRange = z.infer<typeof LineRange>;

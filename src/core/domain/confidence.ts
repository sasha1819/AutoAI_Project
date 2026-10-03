import { z } from "zod";

// Branded so an AI-supplied number has to pass through this schema before any rule can use it.
export const Confidence = z.number().min(0).max(1).brand<"Confidence">();
export type Confidence = z.infer<typeof Confidence>;

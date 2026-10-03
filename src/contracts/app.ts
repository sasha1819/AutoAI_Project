import { z } from "zod";

/** Facts about how the app is running, for the screens (mock mode shows a visible marker). */
export const appInfo = {
  request: z.strictObject({}),
  response: z.strictObject({ mockAi: z.boolean() }),
};

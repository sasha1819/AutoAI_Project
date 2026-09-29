import { z } from "zod";
import { StepStatus } from "../../core/domain/step.ts";

// The lines autoai-reporter.mjs writes. Validated here because they come from another process (and the user's
// own config or server could print a line that merely looks like one).
const PREFIX = "AUTOAI:";

const StepLine = z.object({
  kind: z.literal("step"),
  retry: z.number().int().nonnegative(),
  status: StepStatus,
  step: z.string().min(1),
  durationMs: z.number().int().nonnegative(),
  ts: z.iso.datetime(),
});
const TestLine = z.object({
  kind: z.literal("test"),
  retry: z.number().int().nonnegative(),
  // Playwright's own vocabulary; mapped to AttemptResult (or an error) by the runner.
  status: z.enum(["passed", "failed", "timedOut", "skipped", "interrupted"]),
  durationMs: z.number().int().nonnegative(),
  errors: z.array(z.string()),
  failedStep: z.string().min(1).nullable(),
  screenshotPath: z.string().min(1).nullable(),
  errorContextPath: z.string().min(1).nullable(),
});
const ErrorLine = z.object({ kind: z.literal("error"), message: z.string() });

export const ReporterEvent = z.discriminatedUnion("kind", [StepLine, TestLine, ErrorLine]);
export type ReporterEvent = z.infer<typeof ReporterEvent>;
export type TestLine = z.infer<typeof TestLine>;

/** The event on one stdout line, or null for any other output (the user's logs, Playwright's own messages). */
export function parseReporterLine(line: string): ReporterEvent | null {
  if (!line.startsWith(PREFIX)) return null;
  let json: unknown;
  try {
    json = JSON.parse(line.slice(PREFIX.length));
  } catch (e) {
    if (e instanceof SyntaxError) return null;
    throw e;
  }
  const parsed = ReporterEvent.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/** Splits a byte stream into whole lines; the last, unfinished line is kept until more arrives. */
export function lineSplitter(onLine: (line: string) => void): {
  push: (chunk: string) => void;
  end: () => void;
} {
  let buffer = "";
  return {
    push(chunk) {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) onLine(line.replace(/\r$/, ""));
    },
    end() {
      if (buffer !== "") onLine(buffer);
      buffer = "";
    },
  };
}

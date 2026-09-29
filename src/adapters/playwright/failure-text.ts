// Cleaning up what Playwright reports about a failure, before it is stored or shown.

// Terminal colour codes: Playwright colours its error messages even when nothing reads them in a terminal.
// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI, "");
}

/**
 * The page snapshot inside Playwright's error-context.md: its ```yaml blocks (the whole page, or the element the
 * failing check looked at). The rest of that file is Playwright's instructions for an AI and the test source,
 * which are not page state. Null when the file has no snapshot (older Playwright versions).
 */
export function pageSnapshotOf(errorContext: string): string | null {
  const blocks = [...errorContext.matchAll(/^```yaml\n([\s\S]*?)^```$/gm)].map((m) =>
    (m[1] ?? "").trimEnd(),
  );
  const text = blocks.filter((b) => b !== "").join("\n\n");
  return text === "" ? null : text;
}

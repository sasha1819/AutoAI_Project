/** A file from the user's repo: its repo-relative path ("/"-separated) and its text. */
export type RepoFile = { readonly path: string; readonly text: string };

// How code is shown to Claude and read back from its evidence. Prompt and evidence check must agree, so both
// use these three functions.

/** Splits file text into lines, treating LF and CRLF alike. */
export function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

/** One code line as the prompt shows it: the 1-based number, right-aligned, then " | ", then the line. */
export function numberLine(no: number, line: string): string {
  return `${String(no).padStart(4)} | ${line}`;
}

/** Removes the numberLine prefixes a model sometimes copies into a snippet. */
export function stripLineNumbers(text: string): string {
  return text.replace(/^\s*\d+ \| ?/gm, "");
}

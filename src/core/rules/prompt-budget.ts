import type { RepoFile } from "../domain/repo-file.ts";

/**
 * Most characters of code text one matching prompt may carry (~15k tokens at ~4 chars/token). Sized in
 * BUILD-LOG against real prompts; the instructions and requirements come on top of this.
 */
export const PROMPT_FILE_BUDGET_CHARS = 60_000;
/** Most repo file paths listed in one prompt (~9k chars at ~30 chars a path) as the repo overview. */
export const REPO_FILE_LIST_LIMIT = 300;

export type FittedFiles = {
  readonly included: readonly RepoFile[];
  readonly omitted: readonly string[];
};

/**
 * Takes whole files, best-ranked first, while they fit. A file that does not fit is omitted and named, never
 * cut, so the prompt can tell Claude what it did not see instead of showing half a file.
 */
export function fitFilesToBudget(
  ranked: readonly RepoFile[],
  budget: number = PROMPT_FILE_BUDGET_CHARS,
): FittedFiles {
  const included: RepoFile[] = [];
  const omitted: string[] = [];
  let left = budget;
  for (const file of ranked) {
    if (file.text.length <= left) {
      included.push(file);
      left -= file.text.length;
    } else {
      omitted.push(file.path);
    }
  }
  return { included, omitted };
}

/** Most characters of one failure text (the error, the page snapshot) in a diagnosis prompt (~5k tokens). */
export const FAILURE_TEXT_LIMIT_CHARS = 20_000;

/**
 * Cuts a long failure text to the limit, at a line break when there is one, and says what was cut. Unlike a code
 * file, the start of an error or snapshot is the useful part, so a cut text beats an omitted one.
 */
export function clipFailureText(text: string, limit: number = FAILURE_TEXT_LIMIT_CHARS): string {
  if (text.length <= limit) return text;
  const lastBreak = text.lastIndexOf("\n", limit);
  if (lastBreak > 0) {
    const cutLines = text.slice(lastBreak + 1).split("\n").length;
    return `${text.slice(0, lastBreak)}\n[... ${String(cutLines)} more lines cut]`;
  }
  return `${text.slice(0, limit)}\n[... ${String(text.length - limit)} more characters cut]`;
}

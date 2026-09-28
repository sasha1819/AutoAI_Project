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

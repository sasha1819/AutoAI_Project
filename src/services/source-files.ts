import type { RepoFile } from "../core/domain/repo-file.ts";
import { ok, type Result } from "../core/domain/result.ts";
import type { RepoReadError, RepoReader } from "../core/ports/repo-reader.ts";
import { isSourceFile } from "../core/rules/source-file.ts";

export type SourceFileWarning = {
  readonly code: "SOURCE_FILE_UNREADABLE";
  readonly message: string;
};
export type SourceFiles = {
  /** Every file in the repo, repo-relative. */
  readonly allPaths: readonly string[];
  /** The ones that count as application code (isSourceFile). */
  readonly sourcePaths: readonly string[];
  /** Their text, when asked for; unreadable ones are skipped with a warning. */
  readonly files: readonly RepoFile[];
  readonly warnings: readonly SourceFileWarning[];
};

/** Lists a repo and, if asked, reads its source files: the shared first step of scanning and test generation. */
export async function loadSourceFiles(
  reader: RepoReader,
  root: string,
  options: { readonly readContents: boolean },
): Promise<Result<SourceFiles, RepoReadError>> {
  const listed = await reader.listFiles(root);
  if (!listed.ok) return listed;
  const sourcePaths = listed.value.filter(isSourceFile);
  const files: RepoFile[] = [];
  const warnings: SourceFileWarning[] = [];
  if (options.readContents) {
    for (const path of sourcePaths) {
      const read = await reader.readText(root, path);
      if (read.ok) files.push({ path, text: read.value });
      else
        warnings.push({
          code: "SOURCE_FILE_UNREADABLE",
          message: `${path}: ${read.error.message}`,
        });
    }
  }
  return ok({ allPaths: listed.value, sourcePaths, files, warnings });
}

import type { DomainError } from "../domain/domain-error.ts";
import type { Result } from "../domain/result.ts";

export type RepoReadErrorCode =
  "PATH_NOT_FOUND" | "NOT_A_DIRECTORY" | "NOT_A_FILE" | "PATH_UNREADABLE" | "PATH_OUTSIDE_ROOT";
export type RepoReadError = DomainError<RepoReadErrorCode>;

/** Read-only access to the files under a root folder. Paths are root-relative with forward slashes. */
export type RepoReader = {
  /** Every file under root, recursively, sorted. */
  readonly listFiles: (root: string) => Promise<Result<readonly string[], RepoReadError>>;
  /** A file's UTF-8 text; paths that escape root (including through symlinks) are refused. */
  readonly readText: (root: string, path: string) => Promise<Result<string, RepoReadError>>;
};

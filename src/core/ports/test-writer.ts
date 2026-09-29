import type { DomainError } from "../domain/domain-error.ts";
import type { Result } from "../domain/result.ts";

export type TestWriteErrorCode =
  "REPO_NOT_FOUND" | "PATH_NOT_ALLOWED" | "FILE_EXISTS" | "PATH_UNWRITABLE";
export type TestWriteError = DomainError<TestWriteErrorCode>;

/**
 * Creates generated test files, and nothing else: only new files, only directly inside <repo>/tests/autoai
 * (ADR 0004). Symlinks, other folders and existing files are refused by every implementation.
 */
export type TestWriter = {
  /** Returns the repo-relative path written ("tests/autoai/<fileName>"). */
  readonly writeGeneratedTest: (
    repoRoot: string,
    fileName: string,
    text: string,
  ) => Promise<Result<{ readonly path: string }, TestWriteError>>;
};

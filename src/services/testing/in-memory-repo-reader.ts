import { err, ok } from "../../core/domain/result.ts";
import type { RepoReadError, RepoReader } from "../../core/ports/repo-reader.ts";

export type InMemoryRepoReader = RepoReader & { readonly calls: readonly string[] };

/**
 * Test double for RepoReader: folders are in-memory maps of path -> text. Records every call as "list <root>" or
 * "read <root> <path>". Failures can be scripted per root (listing) or per path (reading).
 */
export function inMemoryRepoReader(
  roots: Readonly<Record<string, Readonly<Record<string, string>>>>,
  fail: {
    readonly list?: Readonly<Record<string, RepoReadError>>;
    readonly read?: Readonly<Record<string, RepoReadError>>;
  } = {},
): InMemoryRepoReader {
  const calls: string[] = [];
  return {
    calls,
    listFiles: (root) => {
      calls.push(`list ${root}`);
      const failure = fail.list?.[root];
      if (failure) return Promise.resolve(err(failure));
      const files = roots[root];
      return Promise.resolve(
        files ? ok(Object.keys(files).sort()) : err({ code: "PATH_NOT_FOUND", message: root }),
      );
    },
    readText: (root, path) => {
      calls.push(`read ${root} ${path}`);
      const failure = fail.read?.[path];
      if (failure) return Promise.resolve(err(failure));
      const text = roots[root]?.[path];
      return Promise.resolve(
        text === undefined ? err({ code: "PATH_NOT_FOUND", message: path }) : ok(text),
      );
    },
  };
}

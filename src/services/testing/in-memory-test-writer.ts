import { err, ok } from "../../core/domain/result.ts";
import type { TestWriteError, TestWriter } from "../../core/ports/test-writer.ts";

export type InMemoryTestWriter = TestWriter & {
  /** Files written in this run: repo-relative path -> text. */
  readonly written: ReadonlyMap<string, string>;
};

/**
 * Test double for TestWriter: never overwrites (like the real one), and can be told to fail every write.
 * `existing` are paths already present in tests/autoai before the run.
 */
export function inMemoryTestWriter(
  existing: readonly string[] = [],
  failWith: TestWriteError | null = null,
): InMemoryTestWriter {
  const written = new Map<string, string>();
  const taken = new Set(existing);
  return {
    written,
    writeGeneratedTest: (_repoRoot, fileName, text) => {
      const path = `tests/autoai/${fileName}`;
      if (failWith) return Promise.resolve(err(failWith));
      if (taken.has(path) || written.has(path)) {
        return Promise.resolve(err({ code: "FILE_EXISTS", message: `${path} already exists` }));
      }
      written.set(path, text);
      return Promise.resolve(ok({ path }));
    },
  };
}

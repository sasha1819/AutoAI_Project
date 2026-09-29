import { lstat, mkdir, realpath, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { err, ok } from "../../core/domain/result.ts";
import type { TestWriteError, TestWriter } from "../../core/ports/test-writer.ts";
import { GENERATED_TEST_DIR } from "../../core/rules/generated-test.ts";

// A plain file name only: no separators, no "..", no leading dot, lower-case kebab-case, ending in .spec.ts.
const FILE_NAME = /^[a-z0-9][a-z0-9-]*\.spec\.ts$/;

/**
 * TestWriter on the local disk (ADR 0004). Confinement is checked here, not trusted from the caller: every folder
 * on the way to <repo>/tests/autoai must be a real folder (never a symlink), and files are created exclusively,
 * so an existing file, or a symlink planted in its place, is never followed or replaced.
 */
export function createFsTestWriter(): TestWriter {
  return {
    async writeGeneratedTest(repoRoot, fileName, text) {
      if (!FILE_NAME.test(fileName)) {
        return err(refuse(`"${fileName}" is not a plain *.spec.ts file name`));
      }

      let realRoot: string;
      try {
        realRoot = await realpath(repoRoot);
        if (!(await stat(realRoot)).isDirectory())
          return err({ code: "REPO_NOT_FOUND", message: `${repoRoot} is not a folder` });
      } catch (e) {
        if (errno(e) === "ENOENT" || errno(e) === "ENOTDIR") {
          return err({ code: "REPO_NOT_FOUND", message: `${repoRoot} does not exist` });
        }
        throw e;
      }

      let folder = realRoot;
      for (const segment of GENERATED_TEST_DIR.split("/")) {
        folder = join(folder, segment);
        const problem = await ensureRealFolder(folder);
        if (problem) return err(problem);
      }

      // Between these checks and the write a folder could in theory be swapped for a symlink; acceptable for a
      // local desktop app writing into the user's own repo, not for a multi-user server.
      try {
        await writeFile(join(folder, fileName), text, { flag: "wx" });
      } catch (e) {
        const code = errno(e);
        if (code === "EEXIST") {
          return err({
            code: "FILE_EXISTS",
            message: `${GENERATED_TEST_DIR}/${fileName} already exists; delete it to regenerate`,
          });
        }
        if (code === "EACCES" || code === "EPERM" || code === "EROFS") {
          return err({ code: "PATH_UNWRITABLE", message: `${GENERATED_TEST_DIR} is not writable` });
        }
        throw e;
      }
      return ok({ path: `${GENERATED_TEST_DIR}/${fileName}` });
    },
  };
}

async function ensureRealFolder(folder: string): Promise<TestWriteError | null> {
  try {
    const info = await lstat(folder);
    if (info.isSymbolicLink()) return refuse(`${folder} is a symlink`);
    if (!info.isDirectory()) return refuse(`${folder} is not a folder`);
    return null;
  } catch (e) {
    if (errno(e) !== "ENOENT") throw e;
  }
  try {
    await mkdir(folder);
    return null;
  } catch (e) {
    // Created by someone else in the meantime: check it again rather than trusting it.
    if (errno(e) === "EEXIST") return ensureRealFolderOnce(folder);
    if (errno(e) === "EACCES" || errno(e) === "EPERM" || errno(e) === "EROFS") {
      return { code: "PATH_UNWRITABLE", message: `cannot create ${folder}` };
    }
    throw e;
  }
}

async function ensureRealFolderOnce(folder: string): Promise<TestWriteError | null> {
  const info = await lstat(folder);
  return info.isDirectory() && !info.isSymbolicLink()
    ? null
    : refuse(`${folder} is not a real folder`);
}

function refuse(message: string): TestWriteError {
  return { code: "PATH_NOT_ALLOWED", message };
}

function errno(e: unknown): string {
  return e instanceof Error && "code" in e && typeof e.code === "string" ? e.code : "";
}

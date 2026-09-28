import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { err, ok } from "../../core/domain/result.ts";
import type { RepoReadError, RepoReadErrorCode, RepoReader } from "../../core/ports/repo-reader.ts";

/** RepoReader over the local disk. Symlinks are not listed; reading one is allowed only if it stays inside root. */
export function createFsRepoReader(): RepoReader {
  return {
    async listFiles(root) {
      try {
        const entries = await readdir(root, { recursive: true, withFileTypes: true });
        const files = entries
          .filter((e) => e.isFile())
          .map((e) => relative(root, join(e.parentPath, e.name)).split(sep).join("/"))
          .sort();
        return ok(files);
      } catch (e) {
        return err(translate(e, root, { ENOENT: "PATH_NOT_FOUND", ENOTDIR: "NOT_A_DIRECTORY" }));
      }
    },

    async readText(root, path) {
      const outside = err<RepoReadError>({
        code: "PATH_OUTSIDE_ROOT",
        message: `${path} ${MESSAGE.PATH_OUTSIDE_ROOT}`,
      });
      if (isAbsolute(path) || !isInside(resolve(root), resolve(root, path))) return outside;
      try {
        // realpath follows symlinks, so a link inside root that points elsewhere is caught here. A link swapped
        // between this check and readFile would slip through; acceptable for a local desktop app reading the
        // user's own repo, not for a multi-user server.
        const [realRoot, realTarget] = await Promise.all([
          realpath(root),
          realpath(resolve(root, path)),
        ]);
        if (!isInside(realRoot, realTarget)) return outside;
        if (!(await stat(realTarget)).isFile())
          return err({ code: "NOT_A_FILE", message: `${path} ${MESSAGE.NOT_A_FILE}` });
        return ok(await readFile(realTarget, "utf8"));
      } catch (e) {
        return err(
          translate(e, path, {
            ENOENT: "PATH_NOT_FOUND",
            ENOTDIR: "PATH_NOT_FOUND",
            EISDIR: "NOT_A_FILE",
          }),
        );
      }
    },
  };
}

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel !== "" && !isAbsolute(rel) && rel.split(sep)[0] !== "..";
}

const MESSAGE: Record<RepoReadErrorCode, string> = {
  PATH_NOT_FOUND: "does not exist",
  NOT_A_DIRECTORY: "is not a folder",
  NOT_A_FILE: "is not a file",
  PATH_UNREADABLE: "cannot be read (permission denied)",
  PATH_OUTSIDE_ROOT: "is outside the folder being read",
};

// Expected filesystem failures become domain codes; anything else is a bug and is rethrown.
function translate(
  e: unknown,
  path: string,
  codes: Partial<Record<string, RepoReadErrorCode>>,
): RepoReadError {
  const errno = e instanceof Error && "code" in e && typeof e.code === "string" ? e.code : "";
  const code =
    codes[errno] ?? (errno === "EACCES" || errno === "EPERM" ? "PATH_UNREADABLE" : undefined);
  if (code === undefined) throw e;
  return { code, message: `${path} ${MESSAGE[code]}` };
}

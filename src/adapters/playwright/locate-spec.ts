import { lstat, realpath, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { err, ok, type Result } from "../../core/domain/result.ts";
import type {
  AttemptRequest,
  TestRunError,
  TestRunErrorCode,
} from "../../core/ports/test-runner.ts";
import { GENERATED_TEST_DIR, generatedTestFileOf } from "../../core/rules/generated-test.ts";

const CONFIG_NAMES = ["ts", "js", "mjs", "cjs", "mts", "cts"].map(
  (ext) => `playwright.config.${ext}`,
);

export type LocatedSpec = {
  /** The repo's real path (symlinks resolved). */
  readonly root: string;
  readonly specFile: string;
  /** The user's playwright.config.* file. */
  readonly config: string;
  /** The repo's own Playwright CLI. */
  readonly cli: string;
};

/**
 * Everything a run needs, checked before anything starts (ADR 0005): the spec is a real file directly inside
 * <repo>/tests/autoai (the same confinement as TestWriter), and the repo has a Playwright config and install.
 */
export async function locateSpec(
  request: AttemptRequest,
): Promise<Result<LocatedSpec, TestRunError>> {
  const specFile = generatedTestFileOf(request.specPath);
  if (specFile === null) {
    return fail(
      "PATH_NOT_ALLOWED",
      `${request.specPath} is not a spec directly inside ${GENERATED_TEST_DIR}`,
    );
  }
  let root: string;
  try {
    root = await realpath(request.repoRoot);
    if (!(await stat(root)).isDirectory())
      return fail("REPO_NOT_FOUND", `${request.repoRoot} is not a folder`);
  } catch (e) {
    if (isMissing(e)) return fail("REPO_NOT_FOUND", `${request.repoRoot} does not exist`);
    throw e;
  }

  // Every folder on the way, and the spec itself, must be real: never a symlink out of the repo.
  let path = root;
  const segments = [...GENERATED_TEST_DIR.split("/"), specFile];
  for (const [i, segment] of segments.entries()) {
    path = join(path, segment);
    const isSpec = i === segments.length - 1;
    try {
      const info = await lstat(path);
      if (info.isSymbolicLink()) return fail("PATH_NOT_ALLOWED", `${path} is a symlink`);
      if (isSpec ? !info.isFile() : !info.isDirectory()) {
        return fail("PATH_NOT_ALLOWED", `${path} is not a regular ${isSpec ? "file" : "folder"}`);
      }
    } catch (e) {
      if (isMissing(e)) return fail("SPEC_NOT_FOUND", `${request.specPath} does not exist`);
      throw e;
    }
  }

  const config = await firstFile(CONFIG_NAMES.map((name) => join(root, name)));
  if (config === null) {
    return fail(
      "PLAYWRIGHT_CONFIG_MISSING",
      "No playwright.config in the repo. Add one with use.baseURL (and webServer to start the app).",
    );
  }
  let cli: string;
  try {
    // Resolved from the repo, as the spec's own `import "@playwright/test"` is. npx is never used.
    cli = createRequire(join(root, "package.json")).resolve("@playwright/test/cli");
  } catch (e) {
    if (errno(e) === "MODULE_NOT_FOUND") {
      return fail(
        "PLAYWRIGHT_NOT_INSTALLED",
        "@playwright/test is not installed in the repo. Add it: npm install -D @playwright/test",
      );
    }
    throw e;
  }
  return ok({ root, specFile, config, cli });
}

async function firstFile(paths: readonly string[]): Promise<string | null> {
  for (const path of paths) {
    try {
      if ((await stat(path)).isFile()) return path;
    } catch (e) {
      if (!isMissing(e)) throw e;
    }
  }
  return null;
}

function fail(code: TestRunErrorCode, message: string): Result<never, TestRunError> {
  return err({ code, message });
}

function isMissing(e: unknown): boolean {
  return errno(e) === "ENOENT" || errno(e) === "ENOTDIR";
}

function errno(e: unknown): string {
  return e instanceof Error && "code" in e && typeof e.code === "string" ? e.code : "";
}

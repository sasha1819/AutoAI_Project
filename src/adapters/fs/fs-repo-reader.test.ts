import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFsRepoReader } from "./fs-repo-reader.ts";

const reader = createFsRepoReader();
let base: string;
let root: string;
const isRootUser = process.getuid?.() === 0;

function put(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "autoai-fs-reader-"));
  root = join(base, "prds");
  put(join(root, "cart.md"), "Cart 2.4: A");
  put(join(root, "checkout", "flow.md"), "## Checkout\nPay.");
  put(join(root, "b.txt"), "notes");
  put(join(root, "locked.md"), "secret");
  put(join(base, "outside.md"), "not yours");
  mkdirSync(join(root, "empty-dir"));
  symlinkSync(join(base, "outside.md"), join(root, "escape.md"));
  symlinkSync(join(root, "cart.md"), join(root, "alias.md"));
  put(join(base, "elsewhere", "secret.md"), "not yours either");
  symlinkSync(join(base, "elsewhere"), join(root, "linked-dir"));
  chmodSync(join(root, "locked.md"), 0o000);
  mkdirSync(join(base, "locked-dir"));
  chmodSync(join(base, "locked-dir"), 0o000);
});

afterAll(() => {
  chmodSync(join(root, "locked.md"), 0o644);
  chmodSync(join(base, "locked-dir"), 0o755);
  rmSync(base, { recursive: true, force: true });
});

describe("FsRepoReader.listFiles", () => {
  it("lists regular files recursively, root-relative with forward slashes, sorted; symlinked files and folders are not followed", async () => {
    expect(await reader.listFiles(root)).toStrictEqual({
      ok: true,
      value: ["b.txt", "cart.md", "checkout/flow.md", "locked.md"],
    });
  });

  it.each([
    ["PATH_NOT_FOUND", () => join(base, "missing")],
    ["NOT_A_DIRECTORY", () => join(root, "cart.md")],
  ])("fails with %s", async (code, path) => {
    const result = await reader.listFiles(path());
    expect(result.ok ? null : result.error.code).toBe(code);
  });

  it.skipIf(isRootUser)("fails with PATH_UNREADABLE when the folder cannot be read", async () => {
    const result = await reader.listFiles(join(base, "locked-dir"));
    expect(result.ok ? null : result.error.code).toBe("PATH_UNREADABLE");
  });
});

describe("FsRepoReader.readText", () => {
  it.each([
    ["cart.md", "Cart 2.4: A"],
    ["checkout/flow.md", "## Checkout\nPay."],
    ["./checkout/../cart.md", "Cart 2.4: A"],
    ["alias.md", "Cart 2.4: A"],
  ])("reads %s", async (path, text) => {
    expect(await reader.readText(root, path)).toStrictEqual({ ok: true, value: text });
  });

  it.each([
    ["missing.md", "PATH_NOT_FOUND"],
    ["cart.md/child.md", "PATH_NOT_FOUND"],
    ["empty-dir", "NOT_A_FILE"],
    ["../outside.md", "PATH_OUTSIDE_ROOT"],
    ["escape.md", "PATH_OUTSIDE_ROOT"],
    ["", "PATH_OUTSIDE_ROOT"],
  ])("refuses %j with %s", async (path, code) => {
    const result = await reader.readText(root, path);
    expect(result.ok ? null : result.error.code).toBe(code);
  });

  it("refuses an absolute path even when it points inside root", async () => {
    const result = await reader.readText(root, join(root, "cart.md"));
    expect(result.ok ? null : result.error.code).toBe("PATH_OUTSIDE_ROOT");
  });

  it.skipIf(isRootUser)("fails with PATH_UNREADABLE when permissions deny reading", async () => {
    const result = await reader.readText(root, "locked.md");
    expect(result.ok ? null : result.error.code).toBe("PATH_UNREADABLE");
  });

  it("fails with PATH_NOT_FOUND when the root itself is missing", async () => {
    const result = await reader.readText(join(base, "missing"), "cart.md");
    expect(result.ok ? null : result.error.code).toBe("PATH_NOT_FOUND");
  });
});

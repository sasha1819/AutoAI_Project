import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFsTestWriter } from "./fs-test-writer.ts";

const writer = createFsTestWriter();
const isRootUser = process.getuid?.() === 0;
let base: string;
let repo: string;
let outside: string;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "autoai-test-writer-"));
  repo = join(base, "repo");
  outside = join(base, "outside");
  mkdirSync(repo);
  mkdirSync(outside);
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

const write = (name = "cart-1-2.spec.ts", text = "// test\n", root = repo) =>
  writer.writeGeneratedTest(root, name, text);
const code = async (p: ReturnType<typeof write>) => {
  const r = await p;
  return r.ok ? r.value.path : r.error.code;
};

describe("FsTestWriter", () => {
  it("creates tests/autoai if needed and writes a new file there", async () => {
    expect(await write()).toStrictEqual({
      ok: true,
      value: { path: "tests/autoai/cart-1-2.spec.ts" },
    });
    expect(readFileSync(join(repo, "tests", "autoai", "cart-1-2.spec.ts"), "utf8")).toBe(
      "// test\n",
    );
  });

  it("never overwrites an existing file (the user may have edited it)", async () => {
    await write("a.spec.ts", "mine");
    expect(await code(write("a.spec.ts", "generated"))).toBe("FILE_EXISTS");
    expect(readFileSync(join(repo, "tests", "autoai", "a.spec.ts"), "utf8")).toBe("mine");
  });

  it("never follows a symlink planted at the target path", async () => {
    mkdirSync(join(repo, "tests", "autoai"), { recursive: true });
    writeFileSync(join(outside, "victim.txt"), "safe");
    symlinkSync(join(outside, "victim.txt"), join(repo, "tests", "autoai", "a.spec.ts"));
    expect(await code(write("a.spec.ts", "evil"))).toBe("FILE_EXISTS");
    expect(readFileSync(join(outside, "victim.txt"), "utf8")).toBe("safe");
  });

  it.each([
    [
      "tests is a symlink out of the repo",
      () => {
        symlinkSync(outside, join(repo, "tests"));
      },
    ],
    [
      "tests/autoai is a symlink out of the repo",
      () => {
        mkdirSync(join(repo, "tests"));
        symlinkSync(outside, join(repo, "tests", "autoai"));
      },
    ],
    [
      "tests/autoai is a symlink to another folder inside the repo",
      () => {
        mkdirSync(join(repo, "src"));
        mkdirSync(join(repo, "tests"));
        symlinkSync(join(repo, "src"), join(repo, "tests", "autoai"));
      },
    ],
    [
      "tests is a file",
      () => {
        writeFileSync(join(repo, "tests"), "x");
      },
    ],
  ])("refuses to write when %s", async (_name, arrange) => {
    arrange();
    expect(await code(write())).toBe("PATH_NOT_ALLOWED");
    expect(readdirSync(outside)).toStrictEqual([]);
    expect(existsSync(join(repo, "src", "cart-1-2.spec.ts"))).toBe(false);
  });

  it.each([
    "../escape.spec.ts",
    "/abs.spec.ts",
    "sub/x.spec.ts",
    "x.ts",
    "Cart.spec.ts",
    "",
    ".spec.ts",
    "a..b.spec.ts/",
  ])("refuses the file name %j", async (name) => {
    expect(await code(write(name))).toBe("PATH_NOT_ALLOWED");
    expect(existsSync(join(repo, "tests"))).toBe(false);
  });

  it.each([
    ["the repo folder is missing", () => join(base, "missing")],
    [
      "the repo path is a file",
      () => {
        writeFileSync(join(base, "file"), "x");
        return join(base, "file");
      },
    ],
  ])("fails with REPO_NOT_FOUND when %s", async (_name, root) => {
    expect(await code(write("a.spec.ts", "x", root()))).toBe("REPO_NOT_FOUND");
  });

  it("accepts a repo root that is itself a symlink to a real folder", async () => {
    symlinkSync(repo, join(base, "link"));
    expect(await code(write("a.spec.ts", "x", join(base, "link")))).toBe("tests/autoai/a.spec.ts");
    expect(existsSync(join(repo, "tests", "autoai", "a.spec.ts"))).toBe(true);
  });

  it.skipIf(isRootUser)("fails with PATH_UNWRITABLE when the folder is read-only", async () => {
    mkdirSync(join(repo, "tests", "autoai"), { recursive: true });
    chmodSync(join(repo, "tests", "autoai"), 0o555);
    try {
      expect(await code(write())).toBe("PATH_UNWRITABLE");
    } finally {
      chmodSync(join(repo, "tests", "autoai"), 0o755);
    }
  });
});

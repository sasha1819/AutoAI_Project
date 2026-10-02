#!/usr/bin/env node
// Proves scripts/check-lockfile.mjs still catches a broken lockfile: runs it on temp copies (real and synthetic)
// in the OS temp dir and checks each exit code. Never touches the repo's package-lock.json.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CHECK = resolve("scripts/check-lockfile.mjs");
const REBUILD = "rm -rf node_modules package-lock.json && npm install";
const real = JSON.parse(readFileSync("package-lock.json", "utf8"));

// Break the real lock the way npm/cli#4828 does: drop the hoisted entry of one recorded optional dependency.
// Pick an optional dependency that resolves only to its hoisted entry: one with its own nested copy (e.g. undici under
// @electron/get) would still resolve after the hoisted entry is dropped, so removing it would break nothing.
const pairs = Object.entries(real.packages).flatMap(([key, p]) =>
  Object.keys(p.optionalDependencies ?? {}).map((dep) => [key, dep]),
);
const [ownerKey, victim] =
  pairs.find(([key, dep]) => !real.packages[`${key}/node_modules/${dep}`] && real.packages[`node_modules/${dep}`]) ?? [];
const brokenReal = {
  ...real,
  packages: Object.fromEntries(Object.entries(real.packages).filter(([k]) => k !== `node_modules/${victim}`)),
};

const synthetic = (packages) => ({ lockfileVersion: 3, packages });
const cases = [
  ["real lockfile", real, 0],
  [`real lockfile without ${victim ?? "?"} (optional dep of ${ownerKey ?? "?"})`, victim ? brokenReal : null, 1],
  ["optional dep hoisted to root", synthetic({ "": {}, "node_modules/a": { optionalDependencies: { b: "1" } }, "node_modules/b": {} }), 0],
  ["optional dep nested under its parent", synthetic({ "": {}, "node_modules/a": { optionalDependencies: { "@s/b": "1" } }, "node_modules/a/node_modules/@s/b": {} }), 0],
  ["nested parent resolving to a hoisted dep", synthetic({ "": {}, "node_modules/x/node_modules/a": { optionalDependencies: { b: "1" } }, "node_modules/b": {} }), 0],
  ["optional dep of the project itself missing", synthetic({ "": { optionalDependencies: { b: "1" } } }), 1],
  ["nested dep of a sibling does not count", synthetic({ "": {}, "node_modules/a": { optionalDependencies: { b: "1" } }, "node_modules/c/node_modules/b": {} }), 1],
  ["workspace key walks up to the root", synthetic({ "": {}, "packages/w": { optionalDependencies: { b: "1" } }, "node_modules/b": {} }), 0],
  ["no packages map", { lockfileVersion: 1, dependencies: {} }, 1],
  ["unparseable lockfile", "{ not json", 1],
];

const dir = mkdtempSync(join(tmpdir(), "autoai-lock-selftest-"));
const problems = [];
try {
  cases.forEach(([name, lock, expected], i) => {
    if (lock === null) return problems.push(`${name}: real lockfile has no optional dependencies left to break`);
    const file = join(dir, `lock-${i}.json`);
    writeFileSync(file, typeof lock === "string" ? lock : JSON.stringify(lock));
    const r = spawnSync(process.execPath, [CHECK, file], { encoding: "utf8" });
    if (r.status !== expected) problems.push(`${name}: expected exit ${expected}, got ${r.status}\n${r.stderr}`);
    if (expected === 1 && !r.stderr.includes(REBUILD))
      problems.push(`${name}: error message does not include the rebuild command`);
  });
  const r = spawnSync(process.execPath, [CHECK, join(dir, "missing.json")], { encoding: "utf8" });
  if (r.status !== 1 || !r.stderr.includes(REBUILD))
    problems.push(`missing lockfile: expected exit 1 with the rebuild command, got ${r.status}\n${r.stderr}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\nlock:selftest FAILED — ${problems.length} problem(s). lock:check no longer guards the lockfile.`);
  process.exit(1);
}
console.log(`lock:selftest OK — ${cases.length} lockfiles judged correctly`);

#!/usr/bin/env node
// Vitest coverage thresholds pass silently when their glob matches no files. After `vitest run --coverage`,
// this checks every guarded folder (coverage-thresholds.json) exists and that each of its source files was
// measured, and says out loud when a folder is still empty. Run it right after test:coverage.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const SUMMARY = "coverage/coverage-summary.json";
const SOURCE = /\.tsx?$/;
const SKIP = /(\.test\.tsx?|\.d\.ts)$/;

function fail(reason) {
  console.error(`coverage:scope FAILED — ${reason}`);
  process.exit(1);
}

const guarded = JSON.parse(readFileSync("coverage-thresholds.json", "utf8"));
const isPct = (n) => typeof n === "number" && n >= 1 && n <= 100;
if (!Array.isArray(guarded.folders) || guarded.folders.length === 0 || !guarded.folders.every((f) => typeof f === "string" && f))
  fail("coverage-thresholds.json: `folders` must be a non-empty list of folder paths");
if (!isPct(guarded.lines) || !isPct(guarded.branches))
  fail("coverage-thresholds.json: `lines` and `branches` must be numbers from 1 to 100 (Vitest ignores a missing one)");

if (!existsSync(SUMMARY)) fail(`${SUMMARY} not found. Run npm run test:coverage first.`);
const reportTime = statSync(SUMMARY).mtimeMs;
const measured = new Set(
  Object.keys(JSON.parse(readFileSync(SUMMARY, "utf8")))
    .filter((k) => k !== "total")
    .map((abs) => relative(process.cwd(), abs)),
);

function* sources(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* sources(p);
    else if (SOURCE.test(name) && !SKIP.test(name)) yield p;
  }
}

const problems = [];
for (const folder of guarded.folders) {
  if (!existsSync(resolve(folder)) || !statSync(folder).isDirectory()) {
    problems.push(`${folder}: guarded folder does not exist (typo or moved?) — its threshold would never apply`);
    continue;
  }
  const files = [...sources(folder)];
  if (files.length === 0) {
    console.log(`coverage:scope NOTICE — ${folder} has no source files yet; ${guarded.lines}% lines/${guarded.branches}% branches applies as soon as one appears`);
    continue;
  }
  for (const f of files) {
    if (!measured.has(f)) problems.push(`${f}: not in the coverage report, so the ${folder} threshold ignores it`);
    else if (statSync(f).mtimeMs > reportTime) problems.push(`${f}: changed after the coverage report was written; run npm run test:coverage`);
  }
  console.log(`coverage:scope — ${folder}: ${files.length} file(s) measured against ${guarded.lines}%/${guarded.branches}%`);
}

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\ncoverage:scope FAILED — ${problems.length} problem(s). Coverage thresholds would silently do nothing.`);
  process.exit(1);
}
console.log("coverage:scope OK");

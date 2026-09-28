#!/usr/bin/env node
// Fails if package-lock.json lost optional (platform-specific) dependency entries, e.g. @rolldown/binding-*.
// npm/cli#4828 drops them when a dependency is added to an existing lock; a clone then gets a broken vitest.
// Reads the lockfile only, no network. Usage: node scripts/check-lockfile.mjs [path-to-package-lock.json]
import { readFileSync } from "node:fs";

const LOCK = process.argv[2] ?? "package-lock.json";
const REBUILD = "rm -rf node_modules package-lock.json && npm install";

function fail(reason) {
  console.error(`lock:check FAILED — ${reason}\n\nRebuild the lockfile:\n  ${REBUILD}`);
  process.exit(1);
}

let packages;
try {
  ({ packages } = JSON.parse(readFileSync(LOCK, "utf8")));
} catch (e) {
  fail(`cannot read ${LOCK}: ${e instanceof Error ? e.message : String(e)}`);
}
if (!packages || typeof packages !== "object") fail(`${LOCK} has no "packages" map (lockfileVersion 2+ expected).`);

// Node resolution inside the lock: look in <from>/node_modules/<name>, then walk up to the root node_modules.
function resolves(from, name) {
  let base = from;
  for (;;) {
    if (`${base ? `${base}/` : ""}node_modules/${name}` in packages) return true;
    if (base === "") return false;
    const at = base.lastIndexOf("node_modules/");
    base = at === -1 ? "" : base.slice(0, at).replace(/\/$/, ""); // -1: workspace key like packages/foo
  }
}

const missing = [];
for (const [key, pkg] of Object.entries(packages)) {
  for (const name of Object.keys(pkg.optionalDependencies ?? {})) {
    if (!resolves(key, name)) missing.push(`${name} (optional dependency of ${key || "the project"})`);
  }
}

if (missing.length) {
  const list = missing.slice(0, 10).map((m) => `  - ${m}`);
  if (missing.length > 10) list.push(`  ... and ${missing.length - 10} more`);
  fail(`${missing.length} optional dependency entr${missing.length === 1 ? "y is" : "ies are"} missing from ${LOCK} (npm/cli#4828):\n${list.join("\n")}`);
}
console.log(`lock:check OK — every optional dependency in ${LOCK} is recorded`);

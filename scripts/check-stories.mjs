#!/usr/bin/env node
// Every design-system component is a folder with its component, its stories (one per state), its behaviour test
// and an index (ARCHITECTURE §7, ADR 0006). Fails when any of the four is missing, or when a component file sits
// loose outside a folder. Usage: node scripts/check-stories.mjs [ui-root]   (default: src/ui)
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.argv[2] ?? "src/ui";
const TIERS = ["primitives", "patterns"].map((t) => join(ROOT, "design-system", t));
const problems = [];
let components = 0;

for (const tier of TIERS) {
  let entries;
  try {
    entries = readdirSync(tier);
  } catch {
    problems.push(`${relative(process.cwd(), tier)} is missing`);
    continue;
  }
  for (const name of entries) {
    if (name.startsWith(".")) continue;
    const path = join(tier, name);
    if (!statSync(path).isDirectory()) {
      problems.push(`${relative(process.cwd(), path)}: components live in their own folder (${name.replace(/\..*$/, "")}/)`);
      continue;
    }
    components++;
    const files = new Set(readdirSync(path));
    for (const needed of [`${name}.tsx`, `${name}.stories.tsx`, `${name}.test.tsx`, "index.ts"]) {
      if (!files.has(needed)) problems.push(`${relative(process.cwd(), path)}: missing ${needed}`);
    }
  }
}

if (problems.length > 0) {
  for (const p of problems) console.error(p);
  console.error(`\nstories:check FAILED — ${problems.length} problem(s). Each component needs X.tsx, X.stories.tsx, X.test.tsx, index.ts.`);
  process.exit(1);
}
console.log(`stories:check OK — ${components} component(s), each with stories, a test and an index`);

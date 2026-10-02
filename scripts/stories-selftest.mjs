#!/usr/bin/env node
// Proves stories:check still bites: builds throwaway src/ui trees in the OS temp dir (never touches the repo) and
// checks each is judged correctly. Usage: node scripts/stories-selftest.mjs
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const CHECK = join(process.cwd(), "scripts", "check-stories.mjs");
const full = (tier, name) => ({
  [`design-system/${tier}/${name}/${name}.tsx`]: "",
  [`design-system/${tier}/${name}/${name}.stories.tsx`]: "",
  [`design-system/${tier}/${name}/${name}.test.tsx`]: "",
  [`design-system/${tier}/${name}/index.ts`]: "",
});
const without = (files, suffix) => Object.fromEntries(Object.entries(files).filter(([p]) => !p.endsWith(suffix)));
const both = { "design-system/primitives/.gitkeep": "", "design-system/patterns/.gitkeep": "" };

// [name, files, should pass]
const cases = [
  ["no components yet", both, true],
  ["a complete primitive and pattern", { ...both, ...full("primitives", "Button"), ...full("patterns", "StatusPill") }, true],
  ["missing stories", { ...both, ...without(full("primitives", "Button"), "Button.stories.tsx") }, false],
  ["missing test", { ...both, ...without(full("patterns", "StatusPill"), "StatusPill.test.tsx") }, false],
  ["missing index", { ...both, ...without(full("primitives", "Button"), "index.ts") }, false],
  ["missing component file", { ...both, ...without(full("primitives", "Button"), "/Button.tsx") }, false],
  ["a loose component file", { ...both, "design-system/primitives/Button.tsx": "" }, false],
  ["a missing tier folder", { "design-system/primitives/.gitkeep": "" }, false],
  ["an internals folder (_name) without stories", { ...both, "design-system/primitives/_field/field-frame.tsx": "" }, true],
  ["a component folder still needs everything", { ...both, "design-system/primitives/Field/field-frame.tsx": "" }, false],
];

const problems = [];
for (const [name, files, shouldPass] of cases) {
  const root = mkdtempSync(join(tmpdir(), "autoai-stories-selftest-"));
  try {
    for (const [path, body] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), body);
    }
    const r = spawnSync(process.execPath, [CHECK, root], { encoding: "utf8" });
    if ((r.status === 0) !== shouldPass) problems.push(`${name}: expected ${shouldPass ? "pass" : "fail"}, got exit ${r.status}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
if (problems.length > 0) {
  for (const p of problems) console.error(p);
  console.error("\nstories:selftest FAILED — stories:check no longer judges these cases correctly.");
  process.exit(1);
}
console.log(`stories:selftest OK — ${cases.length} trees judged correctly`);

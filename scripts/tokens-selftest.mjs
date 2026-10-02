#!/usr/bin/env node
// Proves tokens:check still bites: writes throwaway src/ui trees in the OS temp dir (never touches the repo), one
// per case, and checks each is judged correctly. Usage: node scripts/tokens-selftest.mjs
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const CHECK = join(process.cwd(), "scripts", "check-design-tokens.mjs");
const primitive = (line) => ({ "design-system/primitives/X/X.tsx": `export const x = ${line};\n` });
const feature = (line) => ({ "features/f/F.tsx": `export const x = ${line};\n` });

// [name, files, should pass]
const cases = [
  ["raw values inside the tokens folder", { "design-system/tokens/theme.css": ":root { --tk-a: #0e0f14; --tk-b: rgb(0 0 0 / 0.5); }" }, true],
  ["token utility classes", primitive('"bg-surface p-5 text-md rounded-card h-8"'), true],
  [
    "an arbitrary value that is a defined token variable",
    { "design-system/tokens/theme.css": ":root { --tk-width: 4px; }", ...primitive('"w-[var(--tk-width)]"') },
    true,
  ],
  ["an arbitrary value with an undefined token variable", primitive('"w-[var(--tk-made-up)]"'), false],
  ["an arbitrary value with a made-up variable", primitive('"w-[var(--anything)]"'), false],
  ["an arbitrary variant", primitive('"[&_svg]:size-4"'), true],
  ["a TypeScript index type", primitive("{} as { [key: string]: number }"), true],
  ["px inside a primitive (allowed: only features are px-free)", primitive('"16px"'), true],
  ["a hex colour in a primitive", primitive('"#ff0000"'), false],
  ["a colour function in a primitive", primitive('"rgb(0 0 0)"'), false],
  ["an arbitrary colour", primitive('"bg-[red]"'), false],
  ["an arbitrary size in em", primitive('"w-[3em]"'), false],
  ["an arbitrary size in px", primitive('"p-[3px]"'), false],
  ["an arbitrary percentage", primitive('"p-[3%]"'), false],
  ["an arbitrary property", primitive('"[color:red]"'), false],
  ["a stylesheet outside tokens", { "design-system/primitives/X/X.css": ".x { color: var(--tk-a); }" }, false],
  ["px in a feature", feature('"16px"'), false],
  ["an inline style in a feature", { "features/f/F.tsx": "export const F = () => <div style={{ margin: 0 }} />;\n" }, false],
  ["an ignored line", primitive('"#ff0000" // tokens-ignore'), true],
  ["a class name glued to an expression", { "design-system/primitives/X/X.tsx": "export const x = <p className={`text-sm text-muted${extra}`} />;\n" }, false],
  ["a class name glued to an expression in a constant", { "design-system/primitives/X/X.tsx": "const BOX = `size-4 text-muted${extra}`;\n" }, false],
  ["an id-like template ending in a dash", { "design-system/primitives/X/X.tsx": "const id = `item-${n}`;\n" }, true],
  ["class names separated from an expression", { "design-system/primitives/X/X.tsx": "export const x = <p className={`text-sm ${extra} text-muted`} />;\n" }, true],
  ["a state preview in a story", { "design-system/primitives/X/X.stories.tsx": 'export const s = { "data-preview-state": "hover" };\n' }, true],
  ["a state preview in a component", primitive('{ "data-preview-state": "hover" }'), false],
];

const problems = [];
for (const [name, files, shouldPass] of cases) {
  const root = mkdtempSync(join(tmpdir(), "autoai-tokens-selftest-"));
  try {
    for (const [path, body] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), body);
    }
    const r = spawnSync(process.execPath, [CHECK, root], { encoding: "utf8" });
    if ((r.status === 0) !== shouldPass) problems.push(`${name}: expected ${shouldPass ? "pass" : "fail"}, got exit ${r.status} ${r.stderr.trim()}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
if (problems.length > 0) {
  for (const p of problems) console.error(p);
  console.error("\ntokens:selftest FAILED — tokens:check no longer judges these cases correctly.");
  process.exit(1);
}
console.log(`tokens:selftest OK — ${cases.length} cases judged correctly`);

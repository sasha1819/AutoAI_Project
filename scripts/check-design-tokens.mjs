#!/usr/bin/env node
// Fails if raw design values appear outside src/ui/design-system/tokens.
// Add `// tokens-ignore` at the end of a line for a justified exception.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.argv[2] ?? "src/ui";
const TOKENS_DIR = join(ROOT, "design-system", "tokens");
const FEATURES_DIR = join(ROOT, "features");
const EXT = /\.(tsx?|css|scss)$/;

const rules = [
  { re: /#[0-9a-fA-F]{3,8}\b/, msg: "raw hex color" },
  { re: /\b(rgba?|hsla?|oklch|oklab)\(/, msg: "raw color function" },
  // Any arbitrary value (bg-[red], w-[3em], p-[3px]) except one of our token variables (w-[var(--tk-...)]).
  { re: /\b[a-z][a-z0-9-]*-\[(?!var\(--tk-)[^\]]*\]/, msg: "tailwind arbitrary value (add a token instead)" },
  // Arbitrary properties ([color:red]); a TypeScript index type ([key: string]) has a space and is not matched.
  { re: /(?<![\w$.])\[[a-z-]+:[^\s\]]+\]/, msg: "tailwind arbitrary property (add a token instead)" },
  { re: /\b\d+(\.\d+)?px\b/, msg: "raw pixel value", featuresOnly: true },
  { re: /style=\{\{/, msg: "inline style in a feature", featuresOnly: true },
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (p.startsWith(TOKENS_DIR)) continue;
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (EXT.test(name)) yield p;
  }
}

let problems = 0;
try { statSync(ROOT); } catch { console.log(`tokens:check — ${ROOT} not found, nothing to check`); process.exit(0); }

for (const file of walk(ROOT)) {
  const inFeatures = file.startsWith(FEATURES_DIR + sep);
  // Styles live in the tokens file; components and screens use utility classes only.
  if (/\.(css|scss)$/.test(file)) {
    problems++;
    console.error(`${relative(process.cwd(), file)}  stylesheet outside design-system/tokens: use utility classes`);
    continue;
  }
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    if (line.includes("tokens-ignore")) return;
    for (const r of rules) {
      if (r.featuresOnly && !inFeatures) continue;
      if (r.re.test(line)) {
        problems++;
        console.error(`${relative(process.cwd(), file)}:${i + 1}  ${r.msg}: ${line.trim().slice(0, 100)}`);
      }
    }
  });
}
if (problems) { console.error(`\ntokens:check FAILED — ${problems} problem(s). Use a token or a design-system component.`); process.exit(1); }
console.log("tokens:check OK");

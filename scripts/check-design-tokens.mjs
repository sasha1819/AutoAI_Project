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
  // Tailwind finds classes by reading the source: "text-red${x}" is one unknown word, so the class is never built.
  // Any template literal: class strings also live in constants (BOX, FIELD_LOOK). Checked line by line, so a glued
  // name inside a template spanning several lines would slip through (none exist today). "item-${n}" (ends in "-") is not a
  // class name and is allowed; "${a}${b}" is allowed.
  { re: /`[^`]*[A-Za-z0-9\])]\$\{/, msg: "class name glued to an expression (Tailwind will not see it): add a space" },
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

// ARCHITECTURE §7: violet (accent*, focus-ring, ai-*) is a closed list of five uses. Only the files that implement
// those uses may name violet classes; adding a file here needs the user's approval, like adding a use.
// Matches the token name, not a list of utility prefixes, so every way to write it is caught: any utility
// (border-b-, from-, divide-, ring-offset-, accent-, …), the ! prefix, var(--tk-accent) and var(--color-accent).
// text-on-accent is white, not violet, and is not matched.
const VIOLET = /(?<!on)-(?:-tk-|-color-)?(?:accent(?:-[a-z]+)*|focus-ring|ai-[a-z]+(?:-[a-z]+)*)\b/;
// ARCHITECTURE §7: status colours are mapped from domain values in ONE place. Only these files may name them.
// A name built in a template (`bg-status-${tone}`) is caught too: Tailwind emits it from the full names elsewhere.
const STATUS = /(?:^|[^\w-])[a-z!-]*-(?:-tk-|-color-)?status-(?:[a-z-]+\b|\$\{)/;
const STATUS_FILES = new Set([
  "design-system/primitives/_badge/tone-badge.tsx", // the tone looks, for StatusPill and SeverityTag
]);
// Tokens owned by one component (ARCHITECTURE §7): field-invalid is red (an alias of status-failed) for the
// form-field frame; progress-* (passed green, failed red) for ProgressBar; toast-error-icon (red) for the Toast card.
// Nothing else may name them.
const OWNED = [
  // A template-built name (`text-field-${x}`) is caught too, as for status colours.
  { re: /field-(?:invalid\b|\$\{)/, files: new Set(["design-system/primitives/_field/field-frame.tsx"]), owner: "the form-field frame" },
  { re: /progress-(?:track\b|active\b|passed\b|failed\b|\$\{)/, files: new Set(["design-system/primitives/ProgressBar/ProgressBar.tsx"]), owner: "ProgressBar" },
  { re: /toast-(?:error-(?:icon\b|\$\{)|\$\{)/, files: new Set(["design-system/primitives/Toast/Toast.tsx"]), owner: "the Toast card" },
];
// A file on a list may be tested by name: its own X.test.tsx beside it shares the allowance.
const allowedIn = (files, file) => files.has(relative(ROOT, file).split(sep).join("/").replace(/\.test(\.tsx?)$/, "$1"));
const VIOLET_FILES = new Set([
  "design-system/primitives/Button/button-look.ts", // 1. primary buttons
  "design-system/primitives/_field/field-frame.tsx", // 3. focus ring of every form control
  "design-system/primitives/_list/list-look.ts", // 3. current-option outline in a list
  "design-system/primitives/Checkbox/Checkbox.tsx", // 5. checked state
  "design-system/primitives/Switch/Switch.tsx", // 5. on state
  "design-system/primitives/Tabs/Tabs.tsx", // 4. active-tab underline (and 3. its focus ring)
]);

// The token variables that exist: a var(--tk-...) anywhere else must name one of them.
const defined = new Set();
try {
  for (const name of readdirSync(TOKENS_DIR)) {
    if (!/\.css$/.test(name)) continue;
    for (const m of readFileSync(join(TOKENS_DIR, name), "utf8").matchAll(/(--tk-[a-z0-9-]+)\s*:/g)) defined.add(m[1]);
  }
} catch {
  // No tokens folder: every --tk- reference below is then unknown.
}
try { statSync(ROOT); } catch { console.log(`tokens:check — ${ROOT} not found, nothing to check`); process.exit(0); }

for (const file of walk(ROOT)) {
  const inFeatures = file.startsWith(FEATURES_DIR + sep);
  // Styles live in the tokens file; components and screens use utility classes only.
  // The state-preview hook (theme.css) exists for stories only; the app must never force a visual state.
  if (!file.endsWith(".stories.tsx") && readFileSync(file, "utf8").includes("data-preview-state")) {
    problems++;
    console.error(`${relative(process.cwd(), file)}  data-preview-state is for stories only`);
  }
  // Tailwind 4's outline-none sets the outline style to none, and focus-visible:outline-2 keeps that style: the
  // focus ring never shows. Found on Tabs by screenshot; jsdom tests cannot see it.
  const source = readFileSync(file, "utf8");
  if (/\boutline-none\b/.test(source) && /focus-visible:-?outline-\d/.test(source)) {
    problems++;
    console.error(`${relative(process.cwd(), file)}  outline-none hides the focus-visible ring: remove outline-none`);
  }
  if (/\.(css|scss)$/.test(file)) {
    problems++;
    console.error(`${relative(process.cwd(), file)}  stylesheet outside design-system/tokens: use utility classes`);
    continue;
  }
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    if (line.includes("tokens-ignore")) return;
    for (const m of line.matchAll(/var\((--tk-[a-z0-9-]+)\)/g)) {
      if (!defined.has(m[1])) {
        problems++;
        console.error(`${relative(process.cwd(), file)}:${i + 1}  unknown token ${m[1]} (not defined in tokens)`);
      }
    }
    if (STATUS.test(line) && !allowedIn(STATUS_FILES, file)) {
      problems++;
      console.error(`${relative(process.cwd(), file)}:${i + 1}  status colour outside StatusPill / SeverityTag (ARCHITECTURE §7)`);
    }
    for (const o of OWNED) {
      if (o.re.test(line) && !allowedIn(o.files, file)) {
        problems++;
        console.error(`${relative(process.cwd(), file)}:${i + 1}  token owned by ${o.owner} (ARCHITECTURE §7)`);
      }
    }
    if (VIOLET.test(line) && !allowedIn(VIOLET_FILES, file)) {
      problems++;
      console.error(`${relative(process.cwd(), file)}:${i + 1}  violet outside its closed list of uses (ARCHITECTURE §7)`);
    }
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

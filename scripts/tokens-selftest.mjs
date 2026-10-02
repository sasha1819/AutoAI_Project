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
  ["violet in a file implementing an allowed use", { "design-system/primitives/Switch/Switch.tsx": 'const x = "aria-checked:bg-accent";\n' }, true],
  ["violet anywhere else (a selected chip)", primitive('"bg-accent text-text-on-accent"'), false],
  ["focus-ring colour outside the allowed files", feature('"ring-focus-ring"'), false],
  ["an AI tint outside the allowed files", primitive('"bg-ai-surface"'), false],
  ["a directional violet border (a fake tab underline)", feature('"border-b-2 border-b-accent-strong"'), false],
  ["a violet gradient", primitive('"bg-linear-to-r from-accent to-ai-surface"'), false],
  ["an important violet class", primitive('"!bg-accent"'), false],
  [
    "violet through a token variable",
    { "design-system/tokens/theme.css": ":root { --tk-accent: #6d5ae6; }", ...primitive('"bg-[var(--tk-accent)]"') },
    false,
  ],
  ["white on-accent text is not violet", primitive('"text-text-on-accent"'), true],
  ["a status colour in the tone-badge internals", { "design-system/primitives/_badge/tone-badge.tsx": 'const x = "bg-status-failed-surface";\n' }, true],
  ["a status colour in the tone-badge's own test", { "design-system/primitives/_badge/tone-badge.test.tsx": 'const x = "bg-status-failed-surface";\n' }, true],
  ["a status colour in a story", { "design-system/primitives/X/X.stories.tsx": 'const x = "bg-status-failed-surface";\n' }, false],
  ["a status colour built in a template", feature('`bg-status-${tone}-surface`'), false],
  ["field-invalid in the field frame", { "design-system/primitives/_field/field-frame.tsx": 'const x = "text-field-invalid";\n' }, true],
  ["field-invalid chosen by a screen", feature('"text-field-invalid"'), false],
  ["progress outcome colours in ProgressBar", { "design-system/primitives/ProgressBar/ProgressBar.tsx": 'const x = "bg-progress-passed bg-progress-failed";\n' }, true],
  ["progress green borrowed by a screen", feature('"bg-progress-passed"'), false],
  ["progress red borrowed by another primitive", primitive('"text-progress-failed"'), false],
  ["progress track used by a screen", feature('"bg-progress-track"'), false],
  ["progress token by variable in a screen", feature('"w-[var(--tk-progress-passed)]"'), false],
  ["progress token built in a template", feature('`bg-progress-${part}`'), false],
  ["toast error icon in the Toast card", { "design-system/primitives/Toast/Toast.tsx": 'const x = "text-toast-error-icon";\n' }, true],
  ["toast error icon borrowed as a red by a screen", feature('"text-toast-error-icon"'), false],
  ["toast error icon in the toast provider", { "design-system/primitives/Toast/ToastProvider.tsx": 'const x = "text-toast-error-icon";\n' }, false],
  ["toast token built in a template", feature('`text-toast-${part}`'), false],
  ["a focus ring cancelled by outline-none", primitive('"outline-none focus-visible:outline-2 focus-visible:outline-focus-ring"'), false],
  ["outline-none on a panel with no focus ring", primitive('"outline-none rounded-card"'), true],
  ["meter fill in ConfidenceMeter", { "design-system/patterns/ConfidenceMeter/ConfidenceMeter.tsx": 'const x = "bg-meter-fill";\n' }, true],
  ["meter fill borrowed by a screen", feature('"bg-meter-fill"'), false],
  ["toast token built partway in a template", feature('`text-toast-error-${k}`'), false],
  ["field-invalid built in a template", feature('`text-field-${state}`'), false],
  ["a status colour chosen by a screen", feature('"text-status-failed"'), false],
  ["a status colour in another primitive", primitive('"border-l-status-passed"'), false],
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

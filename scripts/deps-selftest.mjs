#!/usr/bin/env node
// Proves every rule in .dependency-cruiser.cjs still bites: builds a throwaway src/ tree in the OS temp dir
// (never touches the repo), cruises it once, and checks each illegal import trips exactly its own rule
// while the legal set stays clean. Usage: node scripts/deps-selftest.mjs [config-path]
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const REPO = process.cwd();
const CONFIG = resolve(process.argv[2] ?? ".dependency-cruiser.cjs");
const DEPCRUISE = join(REPO, "node_modules", ".bin", "depcruise");
const FAKE_PACKAGES = ["zod", "electron", "fake-lib", "@anthropic-ai/sdk", "typescript", "@playwright/test", "react", "@radix-ui/react-dialog", "lucide-react"];

const leaf = "export const v = 1;\n";
const uses = (...specs) =>
  specs.map((s, i) => `import * as m${i} from "${s}";\n`).join("") +
  `export const w = [${specs.map((_, i) => `m${i}`).join(", ")}];\n`;

// [expected rule, { file: source }] — file paths are unique per case so violations map back to one case.
const illegal = [
  ["no-circular", { "core/domain/c1a.ts": uses("./c1b.ts"), "core/domain/c1b.ts": uses("./c1a.ts") }],
  ["core-is-pure", { "core/rules/c2.ts": uses("../../services/c2t.ts"), "services/c2t.ts": leaf }],
  ["no-node-builtins", { "core/rules/c3.ts": uses("node:path") }],
  ["npm-only-zod", { "core/rules/c4.ts": uses("fake-lib") }],
  ["services-use-core-only", { "services/c5.ts": uses("../adapters/fs/c5t.ts"), "adapters/fs/c5t.ts": leaf }],
  ["services-use-core-only", { "services/c6.ts": uses("../contracts/c6t.ts"), "contracts/c6t.ts": leaf }],
  ["no-node-builtins", { "services/c7.ts": uses("node:fs") }],
  ["npm-only-zod", { "services/c8.ts": uses("fake-lib") }],
  ["adapters-implement-ports-only", { "adapters/fs/c9.ts": uses("../../services/c9t.ts"), "services/c9t.ts": leaf }],
  ["adapters-implement-ports-only", { "adapters/fs/c10.ts": uses("../../contracts/c10t.ts"), "contracts/c10t.ts": leaf }],
  ["adapters-are-independent", { "adapters/fs/c11.ts": uses("../claude/c11t.ts"), "adapters/claude/c11t.ts": leaf }],
  ["contracts-are-leaf", { "contracts/c12.ts": uses("../core/rules/c12t.ts"), "core/rules/c12t.ts": leaf }],
  ["no-node-builtins", { "contracts/c13.ts": uses("node:path") }],
  ["npm-only-zod", { "contracts/c14.ts": uses("fake-lib") }],
  ["ui-is-a-skin", { "ui/features/c15/x.ts": uses("../../../services/c15t.ts"), "services/c15t.ts": leaf }],
  ["ui-reads-domain-types-only", { "ui/features/c16/x.ts": uses("../../../core/rules/c16t.ts"), "core/rules/c16t.ts": leaf }],
  ["no-node-builtins", { "ui/features/c17/x.ts": uses("node:fs") }],
  ["ui-no-electron", { "ui/features/c18/x.ts": uses("electron") }],
  ["design-system-knows-no-features", { "ui/design-system/primitives/c19.ts": uses("../../features/c19/y.ts"), "ui/features/c19/y.ts": leaf }],
  ["tokens-are-a-leaf", { "ui/design-system/tokens/c20.ts": uses("../primitives/c20t.ts"), "ui/design-system/primitives/c20t.ts": leaf }],
  ["primitives-do-not-use-patterns", { "ui/design-system/primitives/c21.ts": uses("../patterns/c21t.ts"), "ui/design-system/patterns/c21t.ts": leaf }],
  ["features-are-isolated", { "ui/features/c22a/x.ts": uses("../c22b/y.ts"), "ui/features/c22b/y.ts": leaf }],
  ["app-cli-no-ui", { "app/main/c23.ts": uses("../../ui/design-system/tokens/c23t.ts"), "ui/design-system/tokens/c23t.ts": leaf }],
  ["app-cli-no-ui", { "cli/c24.ts": uses("../ui/design-system/tokens/c24t.ts"), "ui/design-system/tokens/c24t.ts": leaf }],
  ["not-to-unresolvable", { "services/c25.ts": uses("./c25-missing.ts") }],
  ["only-claude-adapter-uses-anthropic-sdk", { "cli/c26.ts": uses("@anthropic-ai/sdk") }],
  ["only-claude-adapter-uses-anthropic-sdk", { "adapters/fs/c27.ts": uses("@anthropic-ai/sdk") }],
  ["test-fakes-only-in-tests", { "services/c28.ts": uses("./testing/c28t.ts"), "services/testing/c28t.ts": leaf }],
  ["test-fakes-only-in-tests", { "cli/c29.ts": uses("../services/testing/c29t.ts"), "services/testing/c29t.ts": leaf }],
  ["only-playwright-adapter-uses-playwright-and-typescript", { "adapters/fs/c30.ts": uses("typescript") }],
  ["only-playwright-adapter-uses-playwright-and-typescript", { "cli/c31.ts": uses("@playwright/test") }],
  ["only-playwright-adapter-spawns-processes", { "adapters/fs/c32.ts": uses("node:child_process") }],
  ["only-playwright-adapter-spawns-processes", { "cli/c33.ts": uses("child_process") }],
  ["ui-libraries-only-in-ui", { "cli/c34.ts": uses("react") }],
  ["ui-libraries-only-in-ui", { "adapters/fs/c35.ts": uses("lucide-react") }],
  ["features-use-the-design-system", { "ui/features/c36/x.ts": uses("@radix-ui/react-dialog") }],
  ["features-use-the-design-system", { "ui/features/c37/x.ts": uses("lucide-react") }],
  ["features-use-public-primitives", { "ui/features/c38/x.ts": uses("../../design-system/primitives/_field/c38t.ts"), "ui/design-system/primitives/_field/c38t.ts": leaf }],
  ["tone-badge-only-for-status-patterns", { "ui/design-system/primitives/C39/x.ts": uses("../_badge/c39t.ts"), "ui/design-system/primitives/_badge/c39t.ts": leaf }],
  ["toast-card-only-in-toast", { "ui/design-system/patterns/c40/x.ts": uses("../../primitives/Toast/Toast.tsx"), "ui/design-system/primitives/Toast/Toast.tsx": leaf }],
];

const legal = {
  "core/domain/ld.ts": uses("zod"),
  "core/ports/lp.ts": uses("../domain/ld.ts"),
  "core/rules/lr.ts": uses("../domain/ld.ts"),
  "core/rules/lr.test.ts": uses("../../adapters/fs/lf.ts", "node:fs", "fake-lib"),
  "services/ls.ts": uses("../core/rules/lr.ts", "../core/ports/lp.ts", "zod"),
  "services/testing/lfake.ts": uses("../../core/ports/lp.ts"),
  "services/ls.test.ts": uses("./testing/lfake.ts"),
  "adapters/fs/lf.ts": uses("../../core/ports/lp.ts", "node:path", "fake-lib"),
  "adapters/fs/lf2.ts": uses("./lf.ts"),
  "adapters/claude/lcl.ts": uses("../../core/ports/lp.ts", "@anthropic-ai/sdk"),
  "adapters/playwright/lpw.ts": uses("../../core/ports/lp.ts", "typescript", "@playwright/test", "node:path", "node:child_process"),
  "contracts/lc.ts": uses("../core/domain/ld.ts", "zod"),
  "app/main/lm.ts": uses("../../services/ls.ts", "../../adapters/fs/lf.ts", "../../contracts/lc.ts", "electron", "node:path"),
  "app/preload/lpl.ts": uses("../../contracts/lc.ts", "electron"),
  "cli/lcli.ts": uses("../services/ls.ts", "../adapters/fs/lf.ts", "node:path"),
  "ui/design-system/tokens/lt.ts": leaf,
  "ui/design-system/primitives/lpr.ts": uses("../tokens/lt.ts", "fake-lib", "react", "@radix-ui/react-dialog", "lucide-react"),
  "ui/design-system/patterns/lpa.ts": uses("../primitives/lpr.ts", "../tokens/lt.ts"),
  "ui/design-system/primitives/_badge/lb.ts": leaf,
  "ui/design-system/primitives/Toast/ltp.ts": uses("./Toast.tsx"),
  "ui/design-system/primitives/Badge/lbg.ts": uses("../_badge/lb.ts"),
  "ui/design-system/patterns/StatusPill/lsp.ts": uses("../../primitives/_badge/lb.ts"),
  "ui/features/legal/lx.ts": uses("../../design-system/patterns/lpa.ts", "../../../contracts/lc.ts", "../../../core/domain/ld.ts"),
  "ui/features/legal/ly.ts": uses("./lx.ts", "react"),
  "ui/features/legal/lw.tsx": leaf,
  "ui/features/legal/lz.tsx": uses("./lw.tsx", "../../design-system/patterns/lpa.ts"),
};

function writeTree(root) {
  const put = (rel, body) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), body);
  };
  for (const [, files] of illegal) for (const [f, body] of Object.entries(files)) put(`src/${f}`, body);
  for (const [f, body] of Object.entries(legal)) put(`src/${f}`, body);
  for (const pkg of FAKE_PACKAGES) {
    put(`node_modules/${pkg}/package.json`, JSON.stringify({ name: pkg, version: "0.0.0", main: "index.js" }));
    put(`node_modules/${pkg}/index.js`, "module.exports = {};\n");
  }
}

function cruise(root) {
  const r = spawnSync(DEPCRUISE, ["src", "--config", CONFIG, "--output-type", "json"], { cwd: root, encoding: "utf8" });
  // The json reporter exits 0 even with violations, so non-zero here means depcruise itself broke (bad config, crash).
  if (r.status !== 0 || !r.stdout) throw new Error(`depcruise did not run: ${r.stderr || r.stdout}`);
  return JSON.parse(r.stdout);
}

const root = mkdtempSync(join(tmpdir(), "autoai-deps-selftest-"));
const problems = [];
try {
  writeTree(root);
  const result = cruise(root);
  const firedFrom = new Map();
  for (const v of result.summary.violations) {
    const set = firedFrom.get(v.from) ?? new Set();
    set.add(v.rule.name);
    firedFrom.set(v.from, set);
  }
  const cruised = new Set(result.modules.map((m) => m.source));
  const claimed = new Set();

  illegal.forEach(([rule, files], i) => {
    const fired = new Set();
    for (const f of Object.keys(files)) {
      claimed.add(`src/${f}`);
      for (const r of firedFrom.get(`src/${f}`) ?? []) fired.add(r);
    }
    if (fired.size !== 1 || !fired.has(rule))
      problems.push(`case c${i + 1}: expected [${rule}], got [${[...fired].join(", ")}]`);
  });
  for (const f of Object.keys(legal)) {
    const path = `src/${f}`;
    claimed.add(path);
    const isTest = f.endsWith(".test.ts");
    if (!isTest && !cruised.has(path)) problems.push(`legal ${path} was not cruised (resolution broken?)`);
    if (isTest && cruised.has(path)) problems.push(`legal ${path} should be excluded as a test file`);
    const fired = firedFrom.get(path);
    if (fired) problems.push(`legal ${path} tripped [${[...fired].join(", ")}]`);
  }
  for (const from of firedFrom.keys())
    if (!claimed.has(from)) problems.push(`unexpected violation from ${from}`);
} finally {
  rmSync(root, { recursive: true, force: true });
}

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\ndeps:selftest FAILED — ${problems.length} problem(s). A boundary rule no longer bites as intended.`);
  process.exit(1);
}
console.log(`deps:selftest OK — ${illegal.length} illegal cases each tripped their rule; ${Object.keys(legal).length} legal files clean`);

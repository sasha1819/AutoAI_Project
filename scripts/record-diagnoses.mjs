#!/usr/bin/env node
// Records Claude's diagnoses of the three real failures in fixtures/diagnosis (see its README).
// For each case: copies the sample shop to a temp folder, runs the spec with the real runner (retry included), then
// diagnoses it with the real Claude adapter. The run and the recording are saved only when the diagnosis succeeded;
// on any failure it prints "<case>: not recorded. <CODE>: <message>", exits 1, and leaves that case's files as they were.
// Usage: node scripts/record-diagnoses.mjs [--runs-only]
//   --runs-only  runs the tests and saves the runs, but calls no AI (free).
// Needs ANTHROPIC_API_KEY for the diagnoses (about $0.10 for all three).
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClaudeAiProvider } from "../src/adapters/claude/claude-ai-provider.ts";
import { approximateCostUsd } from "../src/adapters/claude/pricing.ts";
import { createFsRepoReader } from "../src/adapters/fs/fs-repo-reader.ts";
import { createPlaywrightTestRunner } from "../src/adapters/playwright/playwright-test-runner.ts";
import { Finding } from "../src/core/domain/finding.ts";
import { RunId } from "../src/core/domain/ids.ts";
import { readAiOptions } from "../src/cli/ai-options.ts";
import { recordDiagnosis } from "../src/cli/record-diagnosis.ts";
import { notRecordedLine } from "../src/cli/staged-recording.ts";
import { runTest } from "../src/services/run-test.ts";

const ROOT = process.cwd();
const FIXTURES = join(ROOT, "fixtures", "diagnosis");
const RECORDINGS = join(ROOT, "fixtures", "recorded", "claude-diagnosis");
const CASES = [
  { name: "app-bug-cart-1-2", spec: "cart-1-2-discount-codes-are-case-insensitive-save10.spec.ts", config: null },
  { name: "test-bug-cart-1-1", spec: "cart-1-1-add-to-basket.spec.ts", config: null },
  { name: "environment-account-3-1", spec: "account-3-1-order-history.spec.ts", config: "login-setup.playwright.config.mjs" },
];
const runsOnly = process.argv.includes("--runs-only");
/** Nothing of this case was saved: say why and stop with status 1 (earlier cases' recordings stay). */
const fail = (name, problem) => {
  console.error(notRecordedLine(name, problem));
  process.exitCode = 1;
};
const findings = JSON.parse(readFileSync(join(ROOT, "fixtures/baselines/m1-scan-result.json"), "utf8")).findings.map(
  (f) => Finding.parse(f),
);
const ai = runsOnly ? null : readAiOptions(process.env, {});
if (!runsOnly && ai === null) {
  console.error("ANTHROPIC_API_KEY is not set. Use --runs-only to run the tests without the AI.");
  process.exit(2);
}

mkdirSync(join(FIXTURES, "runs"), { recursive: true });
const work = mkdtempSync(join(tmpdir(), "autoai-record-diagnoses-"));
let totalCost = 0;
try {
  for (const c of CASES) {
    const repo = join(work, c.name);
    cpSync(join(ROOT, "fixtures", "sample-repo"), repo, { recursive: true });
    mkdirSync(join(repo, "node_modules", "@playwright"), { recursive: true });
    symlinkSync(join(ROOT, "node_modules", "@playwright", "test"), join(repo, "node_modules", "@playwright", "test"));
    mkdirSync(join(repo, "tests", "autoai"), { recursive: true });
    cpSync(join(FIXTURES, "specs", c.spec), join(repo, "tests", "autoai", c.spec));
    if (c.config) cpSync(join(FIXTURES, "configs", c.config), join(repo, "playwright.config.mjs"));

    const ran = await runTest(
      { testRunner: createPlaywrightTestRunner({ artifactsDir: join(work, "artifacts") }) },
      { repoRoot: repo, specPath: `tests/autoai/${c.spec}`, runId: RunId.parse(c.name) },
      () => undefined,
    );
    if (!ran.ok) {
      fail(c.name, ran.error);
      break;
    }
    if (ran.value.status !== "failed") {
      fail(c.name, { code: "NOT_A_CONFIRMED_FAILURE", message: `expected a confirmed failure, got ${ran.value.status}` });
      break;
    }
    // Local screenshot paths are machine-specific and never sent to the AI; the repo path becomes a placeholder.
    const saved = JSON.parse(
      JSON.stringify(ran.value).replaceAll(repo, "<repo>").replaceAll(join(work, "artifacts"), "<artifacts>"),
    );
    const runFile = join(FIXTURES, "runs", `${c.name}.json`);
    const last = ran.value.attempts.at(-1);
    console.log(`${c.name}: ${ran.value.status}; failed step: ${last?.failure?.step ?? "(none)"}`);
    if (runsOnly) {
      writeFileSync(runFile, `${JSON.stringify(saved, null, 2)}\n`);
      continue;
    }

    // The run and its recording belong together (the replay rebuilds the prompt from the run): both are saved only
    // when the diagnosis succeeded, and nothing is deleted before that (recordRun).
    const diagnosed = await recordDiagnosis(
      { aiProvider: createClaudeAiProvider(ai), repoReader: createFsRepoReader() },
      { run: ran.value, findings, recordingsDir: RECORDINGS, name: c.name },
    );
    if (!diagnosed.ok) {
      fail(c.name, diagnosed.error);
      break;
    }
    writeFileSync(runFile, `${JSON.stringify(saved, null, 2)}\n`);
    const d = diagnosed.value;
    const cost = approximateCostUsd(d.model, d.usage) ?? 0;
    totalCost += cost;
    console.log(
      `  -> ${d.diagnosis.likelyCause} (${d.diagnosis.confidence}, ${d.diagnosis.reviewStatus}); ${d.redactions} hidden; ` +
        `${d.usage.aiCalls} call(s), ${d.usage.inputTokens}+${d.usage.outputTokens} tokens, ~$${cost.toFixed(3)}\n` +
        `     ${d.diagnosis.explanation}\n     fix: ${d.diagnosis.suggestedFix ?? "(none)"}` +
        d.diagnosis.notes.map((n) => `\n     note: ${n}`).join(""),
    );
  }
  if (!runsOnly && process.exitCode !== 1) console.log(`Total ~$${totalCost.toFixed(3)}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}

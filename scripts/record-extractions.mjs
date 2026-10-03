#!/usr/bin/env node
// Records Claude's extraction of requirements from the plain-prose PRD fixtures (ADR 0008), for the offline replay
// test (src/services/extract-with-ai.replay.test.ts). Each case sends one PRD file through the real service with the
// real Claude adapter and saves the exact request and answer.
// Usage: node scripts/record-extractions.mjs
// Needs ANTHROPIC_API_KEY (one call per case, a few cents in all). Re-run after changing the extraction prompt.
import { join } from "node:path";
import { createClaudeAiProvider } from "../src/adapters/claude/claude-ai-provider.ts";
import { approximateCostUsd } from "../src/adapters/claude/pricing.ts";
import { createFsRepoReader } from "../src/adapters/fs/fs-repo-reader.ts";
import { readAiOptions } from "../src/cli/ai-options.ts";
import { recordExtraction } from "../src/cli/record-extraction.ts";
import { usageOf } from "../src/services/ask-ai.ts";

const ROOT = process.cwd();
const RECORDINGS = join(ROOT, "fixtures", "recorded", "claude-extraction");
// Plain-prose PRDs the parser reads as 0 requirements (fixtures/README.md).
const CASES = [{ name: "checkout", folder: join(ROOT, "fixtures", "sample-prds"), file: "checkout.md" }];

const ai = readAiOptions(process.env, {});
if (ai === null) {
  console.error("ANTHROPIC_API_KEY is not set.");
  process.exit(2);
}
let totalCost = 0;
for (const c of CASES) {
  // Recorded only when the call succeeded: a failed call is printed, nothing in fixtures/ changes, and we exit 1.
  const recorded = await recordExtraction(
    { aiProvider: createClaudeAiProvider(ai), repoReader: createFsRepoReader() },
    { prdFolder: c.folder, file: c.file, recordingsDir: RECORDINGS, name: c.name },
  );
  if (!recorded.ok) {
    console.error(`${c.name}: not recorded. ${recorded.error.code}: ${recorded.error.message}`);
    process.exit(1);
  }
  const { extracted: result, tally } = recorded.value;
  const usage = usageOf(tally);
  const cost = approximateCostUsd([...tally.models][0] ?? "", usage) ?? 0;
  totalCost += cost;
  console.log(
    `${c.name}: ${result.requirements.length} to compare, ${result.needsReview.length} for review, ${result.dropped} dropped; ` +
      `${usage.aiCalls} call(s), ${usage.inputTokens}+${usage.outputTokens} tokens, ~$${cost.toFixed(3)}`,
  );
  for (const r of result.requirements) console.log(`  compare  ${r.tag}: ${r.text} (line ${r.source.line}, ${r.extraction?.confidence})`);
  for (const r of result.needsReview) console.log(`  review   ${r.area}: ${r.text} (line ${r.source.line}, ${r.confidence})`);
}
console.log(`Total ~$${totalCost.toFixed(3)}`);

import {
  type ClaudeAiProviderOptions,
  createClaudeAiProvider,
} from "../adapters/claude/claude-ai-provider.ts";
import { createFsRepoReader } from "../adapters/fs/fs-repo-reader.ts";
import { createFsTestWriter } from "../adapters/fs/fs-test-writer.ts";
import { createTsSpecChecker } from "../adapters/playwright/ts-spec-checker.ts";
import type { Finding } from "../core/domain/finding.ts";
import { extractRequirements } from "../services/extract-requirements.ts";
import { generateTests } from "../services/generate-tests.ts";
import { scanProject } from "../services/scan-project.ts";
import { recordingAiProvider } from "./recording-ai-provider.ts";

/** Terminal composition root: the only place the CLI creates adapters and hands them to services. */
export function composeCli() {
  const repoReader = createFsRepoReader();
  return {
    extractRequirements: (input: { readonly prdFolder: string }) =>
      extractRequirements({ repoReader }, input),
    scanProject: (
      input: { readonly repoRoot: string; readonly prdFolder: string },
      ai: ClaudeAiProviderOptions,
      record?: { readonly dir: string; readonly runId: string },
    ) => {
      const claude = createClaudeAiProvider(ai);
      const aiProvider = record ? recordingAiProvider(claude, record.dir, record.runId) : claude;
      return scanProject({ repoReader, aiProvider }, input);
    },
    generateTests: (
      input: { readonly repoRoot: string; readonly findings: readonly Finding[] },
      ai: ClaudeAiProviderOptions,
    ) =>
      generateTests(
        {
          repoReader,
          testWriter: createFsTestWriter(),
          specChecker: createTsSpecChecker(),
          aiProvider: createClaudeAiProvider(ai),
        },
        input,
      ),
  };
}

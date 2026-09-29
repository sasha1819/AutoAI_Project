import type { Finding } from "../core/domain/finding.ts";
import type { RepoFile } from "../core/domain/repo-file.ts";
import type { Requirement } from "../core/domain/requirement.ts";
import { ok, type Result } from "../core/domain/result.ts";
import { parseGeneratedTest } from "../core/parsing/generated-test.ts";
import { parsePackageDependencies } from "../core/parsing/package-json.ts";
import type { AiError, AiProvider, AiUsage } from "../core/ports/ai-provider.ts";
import type { RepoReadError, RepoReader } from "../core/ports/repo-reader.ts";
import type { SpecChecker } from "../core/ports/spec-checker.ts";
import type { TestWriter } from "../core/ports/test-writer.ts";
import { buildGenerateTestPrompt } from "../core/prompts/generate-test.ts";
import { aiErrorAction, INVALID_AI_OUTPUT_ATTEMPTS } from "../core/rules/batching.ts";
import {
  checkGeneratedTest,
  existingTestPath,
  GENERATED_TEST_DIR,
  generatedTestFileNames,
  playwrightNotice,
  shouldGenerateTest,
} from "../core/rules/generated-test.ts";
import { fitFilesToBudget } from "../core/rules/prompt-budget.ts";
import { type FileIndex, indexFiles, rankFilesForBatch } from "../core/rules/relevance.ts";
import { loadSourceFiles, type SourceFileWarning } from "./source-files.ts";

export type GeneratedTestStatus = "written" | "exists" | "needs_review" | "not_generated";
export type GeneratedTestOutcome = {
  readonly requirement: Requirement;
  readonly fileName: string;
  readonly status: GeneratedTestStatus;
  /** Repo-relative path, when the file was written or already existed. */
  readonly path?: string;
  readonly title?: string;
  /** The generated code, when there is one (also for needs_review, so a person can look at it). */
  readonly code?: string;
  readonly problems?: readonly string[];
};
export type GenerateTestsResult = {
  readonly tests: readonly GeneratedTestOutcome[];
  /** Findings that get no test (not implemented, or not confirmed). */
  readonly skippedFindings: number;
  readonly notices: readonly string[];
  readonly warnings: readonly SourceFileWarning[];
  readonly stoppedBy: AiError | null;
  readonly models: readonly string[];
  readonly usage: { readonly aiCalls: number } & AiUsage;
};
type Deps = {
  readonly repoReader: RepoReader;
  readonly testWriter: TestWriter;
  readonly specChecker: SpecChecker;
  readonly aiProvider: AiProvider;
};
type Stats = {
  stoppedBy: AiError | null;
  readonly models: Set<string>;
  readonly usage: { aiCalls: number; inputTokens: number; outputTokens: number };
};
type Context = {
  readonly deps: Deps;
  readonly repoRoot: string;
  readonly index: FileIndex;
  readonly byPath: ReadonlyMap<string, RepoFile>;
  readonly stats: Stats;
};

/**
 * Writes a checked Playwright test for each confirmed match or mismatch (ADR 0004): one prompt per requirement,
 * one retry with the problems fed back, never written unless it passes the rules and compiles, never overwriting.
 */
export async function generateTests(
  deps: Deps,
  input: { readonly repoRoot: string; readonly findings: readonly Finding[] },
): Promise<Result<GenerateTestsResult, RepoReadError>> {
  const eligible = input.findings.filter(shouldGenerateTest);
  const loaded = await loadSourceFiles(deps.repoReader, input.repoRoot, {
    readContents: eligible.length > 0,
  });
  if (!loaded.ok) return loaded;
  const { allPaths, files, warnings } = loaded.value;
  const existing =
    eligible.length > 0 ? await readExistingTests(deps.repoReader, input.repoRoot, allPaths) : [];
  const stats: Stats = {
    stoppedBy: null,
    models: new Set(),
    usage: { aiCalls: 0, inputTokens: 0, outputTokens: 0 },
  };
  const context: Context = {
    deps,
    repoRoot: input.repoRoot,
    index: indexFiles(files),
    byPath: new Map(files.map((f) => [f.path, f])),
    stats,
  };

  const tests: GeneratedTestOutcome[] = [];
  const names = generatedTestFileNames(eligible.map((f) => f.requirement));
  for (const [i, finding] of eligible.entries()) {
    const { requirement } = finding;
    const fileName = names[i] ?? "";
    const found = existingTestPath(requirement.tag, fileName, existing);
    if (stats.stoppedBy) {
      tests.push({
        requirement,
        fileName,
        status: "not_generated",
        problems: [`not attempted: stopped by ${stats.stoppedBy.code}`],
      });
    } else if (found !== null) {
      // Never overwrite: the user may have edited it (ADR 0004). No AI call is spent on it.
      tests.push({ requirement, fileName, status: "exists", path: found });
    } else {
      tests.push(await generateOne(context, finding, fileName));
    }
  }

  const notice =
    eligible.length > 0
      ? playwrightNotice(await readDependencies(deps.repoReader, input.repoRoot, allPaths))
      : null;
  return ok({
    tests,
    skippedFindings: input.findings.length - eligible.length,
    notices: notice === null ? [] : [notice],
    warnings,
    stoppedBy: stats.stoppedBy,
    models: [...stats.models],
    usage: stats.usage,
  });
}

async function generateOne(
  ctx: Context,
  finding: Finding,
  fileName: string,
): Promise<GeneratedTestOutcome> {
  const { requirement } = finding;
  const ranked = rankFilesForBatch([requirement], ctx.index).flatMap(
    (p) => ctx.byPath.get(p) ?? [],
  );
  const fitted = fitFilesToBudget(ranked);
  let previousAttempt: { code: string; problems: readonly string[] } | null = null;

  for (let attempt = 1; attempt <= INVALID_AI_OUTPUT_ATTEMPTS; attempt++) {
    const prompt = buildGenerateTestPrompt({
      requirement,
      finding: { type: finding.type, explanation: finding.explanation },
      fileName,
      files: fitted.included,
      omittedFiles: fitted.omitted,
      previousAttempt,
    });
    const reply = await ctx.deps.aiProvider.complete({
      system: prompt.system,
      user: prompt.user,
      jsonSchema: prompt.answerSchema,
    });
    if (!reply.ok) {
      if (aiErrorAction(reply.error.code) === "stop_scan") ctx.stats.stoppedBy = reply.error;
      return {
        requirement,
        fileName,
        status: "not_generated",
        problems: [`${reply.error.code}: ${reply.error.message}`],
      };
    }
    ctx.stats.usage.aiCalls += 1;
    ctx.stats.usage.inputTokens += reply.value.usage.inputTokens;
    ctx.stats.usage.outputTokens += reply.value.usage.outputTokens;
    ctx.stats.models.add(reply.value.model);

    const parsed = parseGeneratedTest(reply.value.text);
    const code = parsed.ok ? parsed.value.code : reply.value.text;
    const problems = parsed.ok
      ? await problemsWith(ctx.deps.specChecker, code, requirement.tag, fileName)
      : [parsed.error.message];
    if (parsed.ok && problems.length === 0) {
      const written = await ctx.deps.testWriter.writeGeneratedTest(ctx.repoRoot, fileName, code);
      if (written.ok)
        return {
          requirement,
          fileName,
          status: "written",
          path: written.value.path,
          title: parsed.value.title,
          code,
        };
      if (written.error.code === "FILE_EXISTS")
        return {
          requirement,
          fileName,
          status: "exists",
          path: `${GENERATED_TEST_DIR}/${fileName}`,
        };
      return {
        requirement,
        fileName,
        status: "not_generated",
        code,
        problems: [`${written.error.code}: ${written.error.message}`],
      };
    }
    if (attempt === INVALID_AI_OUTPUT_ATTEMPTS)
      return { requirement, fileName, status: "needs_review", code, problems };
    previousAttempt = { code, problems };
  }
  // The loop returns on its last attempt; reaching here would mean INVALID_AI_OUTPUT_ATTEMPTS < 1.
  throw new Error("INVALID_AI_OUTPUT_ATTEMPTS must be at least 1");
}

// Rules first (cheap, and their problems are clearer to fix), then the compiler.
async function problemsWith(
  checker: SpecChecker,
  code: string,
  tag: string,
  fileName: string,
): Promise<readonly string[]> {
  const ruleProblems = checkGeneratedTest(code, tag);
  if (ruleProblems.length > 0) return ruleProblems;
  return (await checker.check(fileName, code)).errors;
}

async function readExistingTests(
  reader: RepoReader,
  root: string,
  allPaths: readonly string[],
): Promise<{ path: string; firstLine: string }[]> {
  const existing: { path: string; firstLine: string }[] = [];
  for (const path of allPaths.filter((p) => p.startsWith(`${GENERATED_TEST_DIR}/`))) {
    const read = await reader.readText(root, path);
    // An unreadable file still blocks its own name; it just cannot be matched by header.
    existing.push({ path, firstLine: read.ok ? (read.value.split(/\r?\n/, 1)[0] ?? "") : "" });
  }
  return existing;
}

async function readDependencies(reader: RepoReader, root: string, allPaths: readonly string[]) {
  if (!allPaths.includes("package.json")) return null;
  const read = await reader.readText(root, "package.json");
  return read.ok ? parsePackageDependencies(read.value) : null;
}

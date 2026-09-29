import { createRequire } from "node:module";
import { dirname, join, sep } from "node:path";
import type * as Ts from "typescript";

// The namespace a dynamic import("typescript") gives; Node exposes the compiler API as named exports.
type TypeScript = typeof import("typescript");
import type { SpecChecker } from "../../core/ports/spec-checker.ts";

// The spec is compiled as if it sat next to AutoAI's own node_modules, so "@playwright/test" resolves to AutoAI's
// bundled copy. The target repo's tsconfig, node_modules and TypeScript are never read (ADR 0004). Resolved on the
// first check, not at import time, so a broken install fails a check with a clear message instead of every command.
const require = createRequire(import.meta.url);

function defaultVirtualDir(): string {
  const entry = require.resolve("@playwright/test");
  const nodeModules = entry.slice(
    0,
    entry.lastIndexOf(`${sep}node_modules${sep}`) + `${sep}node_modules`.length,
  );
  return join(dirname(nodeModules), "__autoai_spec_check__");
}

// skipLibCheck and no ambient types: Playwright's .d.ts files mention Node modules whose types are a dev-only
// dependency; without this the check would pass in development and fail in the packaged app.
function compilerOptions(ts: TypeScript): Ts.CompilerOptions {
  return {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
    types: [],
    skipLibCheck: true,
    esModuleInterop: true,
  };
}

type Compiler = {
  readonly ts: typeof Ts;
  readonly dir: string;
  readonly options: Ts.CompilerOptions;
};

/** SpecChecker using the TypeScript compiler API in memory, against AutoAI's bundled Playwright types. */
export function createTsSpecChecker(
  // For tests: simulate where (or whether) AutoAI's own Playwright install is found.
  locate: () => string = defaultVirtualDir,
): SpecChecker {
  // Loaded on the first check: TypeScript is several megabytes, and commands that never check a spec
  // (scan, requirements) should not pay for it.
  let compiler: Compiler | null = null;
  return {
    async check(fileName, text) {
      try {
        compiler ??= await loadCompiler(locate);
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        return {
          errors: [
            `Cannot type-check: AutoAI's bundled @playwright/test could not be loaded (${reason})`,
          ],
        };
      }
      const { ts, dir, options } = compiler;
      const path = join(dir, fileName);
      const host = ts.createCompilerHost(options);
      const getSourceFile = host.getSourceFile.bind(host);
      host.getSourceFile = (name, languageVersion, onError, shouldCreate) =>
        name === path
          ? ts.createSourceFile(name, text, languageVersion, true)
          : getSourceFile(name, languageVersion, onError, shouldCreate);
      const fileExists = host.fileExists.bind(host);
      host.fileExists = (name) => name === path || fileExists(name);
      const readFile = host.readFile.bind(host);
      host.readFile = (name) => (name === path ? text : readFile(name));

      const program = ts.createProgram({ rootNames: [path], options, host });
      const errors = ts
        .getPreEmitDiagnostics(program)
        .filter((d) => d.category === ts.DiagnosticCategory.Error)
        .map((d) => format(ts, d));
      return { errors };
    },
  };
}

async function loadCompiler(locate: () => string): Promise<Compiler> {
  const dir = locate();
  const ts = await import("typescript");
  return { ts, dir, options: compilerOptions(ts) };
}

function format(ts: TypeScript, d: Ts.Diagnostic): string {
  const message = ts.flattenDiagnosticMessageText(d.messageText, " ");
  if (!d.file || d.start === undefined) return message;
  const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
  return `${String(line + 1)}:${String(character + 1)} ${message}`;
}

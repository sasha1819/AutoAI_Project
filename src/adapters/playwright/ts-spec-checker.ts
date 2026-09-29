import { createRequire } from "node:module";
import { dirname, join, sep } from "node:path";
import ts from "typescript";
import type { SpecChecker } from "../../core/ports/spec-checker.ts";

// The spec is compiled as if it sat next to AutoAI's own node_modules, so "@playwright/test" resolves to AutoAI's
// bundled copy. The target repo's tsconfig, node_modules and TypeScript are never read (ADR 0004).
const require = createRequire(import.meta.url);
const entry = require.resolve("@playwright/test");
const NODE_MODULES = entry.slice(
  0,
  entry.lastIndexOf(`${sep}node_modules${sep}`) + `${sep}node_modules`.length,
);
const VIRTUAL_DIR = join(dirname(NODE_MODULES), "__autoai_spec_check__");

// skipLibCheck and no ambient types: Playwright's .d.ts files mention Node modules whose types are a dev-only
// dependency; without this the check would pass in development and fail in the packaged app.
const OPTIONS: ts.CompilerOptions = {
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

/** SpecChecker using the TypeScript compiler API in memory, against AutoAI's bundled Playwright types. */
export function createTsSpecChecker(): SpecChecker {
  return {
    check(fileName, text) {
      const path = join(VIRTUAL_DIR, fileName);
      const host = ts.createCompilerHost(OPTIONS);
      const getSourceFile = host.getSourceFile.bind(host);
      host.getSourceFile = (name, languageVersion, onError, shouldCreate) =>
        name === path
          ? ts.createSourceFile(name, text, languageVersion, true)
          : getSourceFile(name, languageVersion, onError, shouldCreate);
      const fileExists = host.fileExists.bind(host);
      host.fileExists = (name) => name === path || fileExists(name);
      const readFile = host.readFile.bind(host);
      host.readFile = (name) => (name === path ? text : readFile(name));

      const program = ts.createProgram({ rootNames: [path], options: OPTIONS, host });
      const errors = ts
        .getPreEmitDiagnostics(program)
        .filter((d) => d.category === ts.DiagnosticCategory.Error)
        .map((d) => format(d));
      return Promise.resolve({ errors });
    },
  };
}

function format(d: ts.Diagnostic): string {
  const message = ts.flattenDiagnosticMessageText(d.messageText, " ");
  if (!d.file || d.start === undefined) return message;
  const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
  return `${String(line + 1)}:${String(character + 1)} ${message}`;
}

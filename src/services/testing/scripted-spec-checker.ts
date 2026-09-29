import type { SpecChecker } from "../../core/ports/spec-checker.ts";

export type ScriptedSpecChecker = SpecChecker & { readonly checked: readonly string[] };

/**
 * Test double for SpecChecker: answers checks in order from a script of error lists; once the script runs out,
 * every spec compiles. Records the code of every check.
 */
export function scriptedSpecChecker(...script: (readonly string[])[]): ScriptedSpecChecker {
  const checked: string[] = [];
  return {
    checked,
    check: (_fileName, text) => {
      checked.push(text);
      return Promise.resolve({ errors: script.shift() ?? [] });
    },
  };
}

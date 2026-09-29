import type { Result } from "../../core/domain/result.ts";
import type { AttemptReport } from "../../core/domain/run.ts";
import type { AttemptRequest, TestRunError, TestRunner } from "../../core/ports/test-runner.ts";

export type ScriptedTestRunner = TestRunner & { readonly requests: readonly AttemptRequest[] };

/**
 * Test double for TestRunner: answers attempts in order from a script, streaming each report's steps to onStep
 * first, as the real runner does. Running past the end of the script is a test bug. Records every request.
 */
export function scriptedTestRunner(
  ...script: Result<AttemptReport, TestRunError>[]
): ScriptedTestRunner {
  const requests: AttemptRequest[] = [];
  return {
    requests,
    runAttempt: (request, onStep) => {
      requests.push(request);
      const next = script.shift();
      if (next === undefined)
        throw new Error(`no scripted result for attempt ${String(request.attempt)}`);
      if (next.ok) for (const step of next.value.steps) onStep(step);
      return Promise.resolve(next);
    },
  };
}

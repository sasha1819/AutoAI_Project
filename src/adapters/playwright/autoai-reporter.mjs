// AutoAI's Playwright reporter (ADR 0005). It runs inside the USER's Playwright process, so it is plain JavaScript
// that imports nothing. Each event is one stdout line: "AUTOAI:" + JSON. The adapter reads only those lines and
// validates them; anything else on stdout is ignored.
const PREFIX = "AUTOAI:";
// What a person would call a step: actions, checks and test.step blocks. Browser/page setup inside fixtures and
// hooks is left out.
const STEP_CATEGORIES = new Set(["pw:api", "expect", "test.step"]);
const SETUP_CATEGORIES = new Set(["hook", "fixture"]);

function emit(event) {
  process.stdout.write(`${PREFIX}${JSON.stringify(event)}\n`);
}

function isUserStep(step) {
  if (!STEP_CATEGORIES.has(step.category)) return false;
  for (let parent = step.parent; parent; parent = parent.parent) {
    if (SETUP_CATEGORIES.has(parent.category)) return false;
  }
  return true;
}

function stepName(step) {
  const locator = step.params?.locator;
  return typeof locator === "string" ? `${step.title} ${locator}` : step.title;
}

function stepTime(step, extraMs) {
  return new Date(step.startTime.getTime() + extraMs).toISOString();
}

export default class AutoAiReporter {
  // The first failed step of each test result, by test id: the innermost step ends (and fails) first.
  failedStep = new Map();

  printsToStdio() {
    return true;
  }

  onStepBegin(test, result, step) {
    if (!isUserStep(step)) return;
    emit({
      kind: "step",
      retry: result.retry,
      status: "running",
      step: stepName(step),
      durationMs: 0,
      ts: stepTime(step, 0),
    });
  }

  onStepEnd(test, result, step) {
    if (!isUserStep(step)) return;
    const status = step.error ? "failed" : "passed";
    if (status === "failed" && !this.failedStep.has(test.id))
      this.failedStep.set(test.id, stepName(step));
    const durationMs = Math.max(0, Math.round(step.duration));
    emit({
      kind: "step",
      retry: result.retry,
      status,
      step: stepName(step),
      durationMs,
      ts: stepTime(step, durationMs),
    });
  }

  onTestEnd(test, result) {
    const attachment = (name) =>
      result.attachments.find((a) => a.name === name && typeof a.path === "string")?.path;
    emit({
      kind: "test",
      retry: result.retry,
      status: result.status,
      durationMs: Math.max(0, Math.round(result.duration)),
      errors: result.errors.map((e) => e.message ?? e.value ?? "").filter((m) => m !== ""),
      failedStep: this.failedStep.get(test.id) ?? null,
      screenshotPath: attachment("screenshot") ?? null,
      errorContextPath: attachment("error-context") ?? null,
    });
    this.failedStep.delete(test.id);
  }

  onError(error) {
    emit({ kind: "error", message: error.message ?? error.value ?? "unknown error" });
  }
}

import { Check, CircleDashed, LoaderCircle, TriangleAlert, X } from "lucide-react";
import type { RunStatus } from "../../../../core/domain/run.ts";
import type { StepStatus } from "../../../../core/domain/step.ts";
import { type BadgeTone, ToneBadge } from "../../primitives/_badge/index.ts";
import type { IconGlyph } from "../../primitives/Icon/index.ts";

/** A run's outcome, or a step that is still running. */
export type PillStatus = RunStatus | StepStatus;

// The one place a status gets its colour (ARCHITECTURE §7): green passed, red failed, yellow flaky, blue running,
// grey not run. Each also has its own word and icon shape, so colour is never the only cue.
const LOOK: Record<
  PillStatus,
  { readonly label: string; readonly tone: BadgeTone; readonly icon: IconGlyph }
> = {
  passed: { label: "Passed", tone: "passed", icon: Check },
  failed: { label: "Failed", tone: "failed", icon: X },
  flaky: { label: "Flaky", tone: "warning", icon: TriangleAlert },
  running: { label: "Running", tone: "running", icon: LoaderCircle },
  not_run: { label: "Not run", tone: "neutral", icon: CircleDashed },
};

export type StatusPillProps = { readonly status: PillStatus };

/** A status as a caps badge with an icon (mockup 7: "× FAILED", mockup 14: "FLAKY"). Screens pass the status, never a colour. */
export function StatusPill({ status }: StatusPillProps) {
  // The type allows only known statuses; a value from unchecked data must not render a blank pill.
  if (!Object.hasOwn(LOOK, status)) throw new Error(`StatusPill: unknown status "${status}"`);
  const { label, tone, icon } = LOOK[status];
  return (
    <ToneBadge label={label} tone={tone} icon={icon} uppercase iconSpins={status === "running"} />
  );
}

import { Check, CircleDashed, LoaderCircle, TriangleAlert, X } from "lucide-react";
import type { RunStatus } from "../../../../core/domain/run.ts";
import type { StepStatus } from "../../../../core/domain/step.ts";
import { type BadgeTone, ToneBadge, ToneDot, ToneGlyph } from "../../primitives/_badge/index.ts";
import type { IconGlyph, IconSize } from "../../primitives/Icon/index.ts";

/** A run's outcome, or a step that is still running. */
export type PillStatus = RunStatus | StepStatus;

// The one place a status gets its colour (ARCHITECTURE §7): green passed, red failed, yellow flaky, blue running,
// grey not run. Each also has its own word and icon shape, so colour is never the only cue.
const LOOK: Record<
  PillStatus,
  { readonly label: string; readonly tone: Exclude<BadgeTone, "plain">; readonly icon: IconGlyph }
> = {
  passed: { label: "Passed", tone: "passed", icon: Check },
  failed: { label: "Failed", tone: "failed", icon: X },
  flaky: { label: "Flaky", tone: "warning", icon: TriangleAlert },
  running: { label: "Running", tone: "running", icon: LoaderCircle },
  not_run: { label: "Not run", tone: "neutral", icon: CircleDashed },
};

export type StatusPillProps = { readonly status: PillStatus };

/** A status as a caps badge with an icon (mockup 7: "× FAILED", mockup 14: "FLAKY"). Screens pass the status, never a colour. */
function lookOf(status: PillStatus) {
  // The type allows only known statuses; a value from unchecked data must not render a blank status.
  if (!Object.hasOwn(LOOK, status)) throw new Error(`StatusPill: unknown status "${status}"`);
  return LOOK[status];
}

/** The status in words ("Passed"), for a row that shows only the icon or dot: say it to screen readers too. */
export function statusWord(status: PillStatus): string {
  return lookOf(status).label;
}

export function StatusPill({ status }: StatusPillProps) {
  const { label, tone, icon } = lookOf(status);
  return (
    <ToneBadge label={label} tone={tone} icon={icon} uppercase iconSpins={status === "running"} />
  );
}

/**
 * The status as a coloured glyph (step rows, run log lines): the same icon and colour as the pill. Decorative: the
 * row must say the status in words too (statusWord, often sr-only).
 */
export function StatusIcon({
  status,
  size = "sm",
}: {
  readonly status: PillStatus;
  readonly size?: IconSize;
}) {
  const { tone, icon } = lookOf(status);
  return <ToneGlyph tone={tone} icon={icon} size={size} spins={status === "running"} />;
}

/** The status as an 8px dot (the test list in mockup 4). Decorative, like StatusIcon. */
export function StatusDot({ status }: { readonly status: PillStatus }) {
  return <ToneDot tone={lookOf(status).tone} />;
}

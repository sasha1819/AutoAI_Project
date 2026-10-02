import type { Severity } from "../../../../core/domain/finding.ts";
import { type BadgeTone, ToneBadge } from "../../primitives/_badge/index.ts";

// Mockup 11: High is the failed red, Medium the warning yellow, Low neutral grey; title case, no icon. The word
// carries the meaning, so colour is never the only cue.
const LOOK: Record<Severity, { readonly label: string; readonly tone: BadgeTone }> = {
  high: { label: "High", tone: "failed" },
  medium: { label: "Medium", tone: "warning" },
  low: { label: "Low", tone: "neutral" },
};

export type SeverityTagProps = { readonly severity: Severity };

/** How serious a finding is. Screens pass the severity, never a colour. */
export function SeverityTag({ severity }: SeverityTagProps) {
  if (!Object.hasOwn(LOOK, severity))
    throw new Error(`SeverityTag: unknown severity "${severity}"`);
  const { label, tone } = LOOK[severity];
  return <ToneBadge label={label} tone={tone} />;
}

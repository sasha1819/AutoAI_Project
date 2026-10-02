import type { Confidence } from "../../../../core/domain/finding.ts";

export type ConfidenceMeterProps = {
  /** How sure the AI is, 0 to 1, as validated at the boundary. */
  readonly confidence: Confidence;
};

/**
 * How sure the AI said it was (a finding, a diagnosis): a small neutral bar and "72% confident". Shows the number
 * only: whether that is enough to show something as fact is decided in core (reviewStatus), never here. Neutral on
 * purpose: not a status colour and not violet (ARCHITECTURE §7 lists confidence as not AI-coloured). A meter for
 * assistive tech, read as "Confidence, 72% confident".
 */
export function ConfidenceMeter({ confidence }: ConfidenceMeterProps) {
  const value: number = confidence;
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`ConfidenceMeter: confidence must be between 0 and 1, got ${String(value)}`);
  }
  const percent = Math.round(value * 100);
  const words = `${String(percent)}% confident`;
  return (
    <span className="inline-flex shrink-0 items-center gap-2">
      <span
        role="meter"
        aria-label="Confidence"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={words}
        className="relative h-1 w-12 overflow-hidden rounded-full bg-meter-track"
      >
        {/* Data, not a design value: the share sets the fill's width. */}
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-meter-fill"
          style={{ width: `${String(percent)}%` }}
        />
      </span>
      <span aria-hidden="true" className="text-xs text-text-secondary tabular-nums">
        {words}
      </span>
    </span>
  );
}

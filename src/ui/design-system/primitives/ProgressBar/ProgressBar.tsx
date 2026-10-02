import { assertAccessibleName, type NonEmpty } from "../../accessibility/accessible-name.ts";

export type ProgressBarProps<Label extends string = string> = {
  /** What is progressing ("Run progress"): the bar's accessible name. Not shown; the screen titles the area. */
  readonly label: NonEmpty<Label>;
  /** Work done, from 0 to max. Leave it out while the total is unknown: the bar is then indeterminate. */
  readonly value?: number;
  /** The total. Defaults to 100. */
  readonly max?: number;
  /** The progress in words ("4 of 9 done"): shown before the bar and read out instead of a percentage. */
  readonly valueText?: string;
};

/**
 * A thin (4px) progress bar, as the run bar in mockup 4. The stacked coverage bars of mockup 6 are a later pattern.
 * A progress bar: a closed set of props, nothing spread. A value outside 0..max is shown clamped (a stream can run
 * ahead of its total); a value or max that is not a number, or a max of 0 or less, is a bug and throws.
 */
export function ProgressBar<Label extends string>({
  label,
  value,
  max = 100,
  valueText,
}: ProgressBarProps<Label>) {
  assertAccessibleName(label, "ProgressBar");
  if (!Number.isFinite(max) || max <= 0)
    throw new Error(`ProgressBar max must be a number above 0, got ${String(max)}`);
  if (value !== undefined && !Number.isFinite(value))
    throw new Error(`ProgressBar value must be a number, got ${String(value)}`);
  const done = value === undefined ? undefined : Math.min(Math.max(value, 0), max);
  const text = valueText !== undefined && valueText.trim() !== "" ? valueText : undefined;
  return (
    <div className="flex w-full items-center gap-3">
      {text !== undefined && (
        // Read out once, as the bar's value text; shown here for sighted users.
        <span aria-hidden="true" className="shrink-0 text-xs text-text-secondary">
          {text}
        </span>
      )}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={done}
        aria-valuetext={text}
        className="relative h-1 w-full min-w-8 overflow-hidden rounded-full bg-progress-track"
      >
        {done === undefined ? (
          // Neutral, not the "done" green: nothing is done yet. Reduced motion: the slide stops on a centred third.
          <div className="absolute inset-y-0 w-1/3 rounded-full bg-progress-busy animate-progress-slide motion-reduce:left-1/3 motion-reduce:animate-none" />
        ) : (
          // Data, not a design value: the share done sets the fill's width (a width, not a scale, keeps the ends round).
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-progress-fill"
            style={{ width: `${String((done / max) * 100)}%` }}
          />
        )}
      </div>
    </div>
  );
}

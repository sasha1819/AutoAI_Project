import { type ReactNode, useId } from "react";
import { assertAccessibleName, isBlank } from "../../accessibility/accessible-name.ts";

// What every form control (Input, Select, later Checkbox and Switch) shares, so they cannot drift apart: the field
// edge (border-field, 3:1 on every surface, see theme.css), the focus ring outside it, the invalid and disabled
// looks, the heights, and the label / hint / error wiring for screen readers.

export type FieldSize = "sm" | "md" | "lg";

// Rest, hover (per control, since what may hover differs), focus and invalid are always distinguishable.
export const FIELD_LOOK =
  "rounded-control border border-border-field bg-surface text-text-primary transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring " +
  "aria-invalid:border-field-invalid " +
  "disabled:cursor-not-allowed disabled:opacity-disabled";

/** Measured in the mockups: sm 28 (title-bar search, toolbar pickers) · md 36 (form fields) · lg 44 (page level). */
export const FIELD_HEIGHT: Record<FieldSize, string> = {
  sm: "h-7 text-sm",
  md: "h-9 text-md",
  lg: "h-11 text-md",
};

export type FieldWiring = {
  /** For the control itself. */
  readonly id: string;
  /** The visible (or visually hidden) label's id, for controls named by aria-labelledby. */
  readonly labelId: string;
  readonly invalid: boolean;
  /** The error first, then the hint; undefined when there is neither. */
  readonly describedBy: string | undefined;
};

export type FieldFrameProps = {
  /** Checked here: a field without a name is announced as just "edit text" or "combo box". */
  readonly label: string;
  readonly hideLabel: boolean;
  readonly hint: string | undefined;
  readonly error: string | undefined;
  /** For the error message when the label is blank, e.g. "Input". */
  readonly component: string;
  /** fill: as wide as its container (forms) · hug: as wide as its content (a toolbar filter). */
  readonly width?: "fill" | "hug";
  /**
   * Whether clicking the label moves to the control (a native label link). Off for controls that open on click,
   * where a label click would open them only sometimes; their name still comes from aria-labelledby.
   */
  readonly labelClickFocuses?: boolean;
  /** Renders the control, given the ids and states it must carry. */
  readonly children: (wiring: FieldWiring) => ReactNode;
};

/** A form control's label, the control, and its error and hint, wired for screen readers. */
export function FieldFrame({
  label,
  hideLabel,
  hint,
  error,
  component,
  width = "fill",
  labelClickFocuses = true,
  children,
}: FieldFrameProps) {
  assertAccessibleName(label, component);
  const id = useId();
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasError = error !== undefined && !isBlank(error);
  const hasHint = hint !== undefined && !isBlank(hint);
  const describedBy = [hasError ? errorId : null, hasHint ? hintId : null].filter(
    (x) => x !== null,
  );

  return (
    <div className={`flex flex-col gap-1.5 ${width === "fill" ? "w-full" : "w-auto"}`}>
      <label
        id={labelId}
        htmlFor={labelClickFocuses ? id : undefined}
        className={hideLabel ? "sr-only" : "text-sm font-medium text-text-primary"}
      >
        {label}
      </label>
      {children({
        id,
        labelId,
        invalid: hasError,
        describedBy: describedBy.length > 0 ? describedBy.join(" ") : undefined,
      })}
      {hasError && (
        <p id={errorId} className="text-sm text-field-invalid">
          {error}
        </p>
      )}
      {hasHint && (
        <p id={hintId} className="text-sm text-text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

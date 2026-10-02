import { type ReactNode, useId } from "react";
import { assertAccessibleName, isBlank } from "../../accessibility/accessible-name.ts";

// What every form control (Input, Select, later Checkbox and Switch) shares, so they cannot drift apart: the field
// edge (border-field, 3:1 on every surface, see theme.css), the focus ring outside it, the invalid and disabled
// looks, the heights, and the label / hint / error wiring for screen readers.

export type FieldSize = "sm" | "md" | "lg";

// What every control shares regardless of its colours: a 1px edge, the focus ring outside it, the invalid edge and
// the disabled look. Each control sets its own edge and fill colours, so no property is set by two classes (a
// checkbox's edge turns violet when checked; a text field's never does). Rest, hover (per control), focus and
// invalid are always distinguishable.
export const FIELD_STATES =
  "border transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring " +
  "aria-invalid:border-field-invalid " +
  "disabled:cursor-not-allowed disabled:opacity-disabled";

/** A text-like field (Input, Select's trigger): the shared states with the field edge and the surface fill. */
export const FIELD_LOOK = `${FIELD_STATES} rounded-control border-border-field bg-surface text-text-primary`;

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
  /**
   * stacked: the label above the control (text fields, selects) · inline: the control, then its label beside it
   * (a checkbox, a switch), with hint and error lined up under the label.
   */
  readonly layout?: "stacked" | "inline";
  /** Inline only: how wide the control is, so the hint and error line up under the label text. */
  readonly controlWidth?: "box" | "switch";
  /** Dims an inline label too: there the label is the main click target, so it must not look clickable. */
  readonly disabled?: boolean;
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
  layout = "stacked",
  controlWidth = "box",
  disabled = false,
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

  const wiring: FieldWiring = {
    id,
    labelId,
    invalid: hasError,
    describedBy: describedBy.length > 0 ? describedBy.join(" ") : undefined,
  };
  const labelElement = (
    <label
      id={labelId}
      htmlFor={labelClickFocuses ? id : undefined}
      className={
        hideLabel
          ? "sr-only"
          : layout === "inline"
            ? // Fills the 24px row from the control's edge (pl-2 is the gap), so box, gap and label are one
              // continuous click target of at least 24px (WCAG 2.5.8). Medium weight, as mockup 5's radio labels.
              `inline-flex self-stretch items-center pl-2 text-md font-medium text-text-primary ${disabled ? "cursor-not-allowed opacity-disabled" : "cursor-pointer"}`
            : "text-sm font-medium text-text-primary"
      }
    >
      {label}
    </label>
  );
  // Whole class names only: Tailwind finds classes by reading the source, so a name glued to an expression is lost.
  // Inline: under the label text, past the control and the 8px gap (box 16 → 24, switch 38 → 46).
  const messageIndent =
    layout === "inline" && !hideLabel ? (controlWidth === "switch" ? "pl-11.5" : "pl-6") : "";
  return (
    <div className={`flex flex-col gap-1.5 ${width === "fill" ? "w-full" : "w-auto"}`}>
      {layout === "inline" ? (
        <div className="flex min-h-6 items-center">
          {children(wiring)}
          {labelElement}
        </div>
      ) : (
        <>
          {labelElement}
          {children(wiring)}
        </>
      )}
      {hasError && (
        <p id={errorId} className={`text-sm text-field-invalid ${messageIndent}`}>
          {error}
        </p>
      )}
      {hasHint && (
        <p id={hintId} className={`text-sm text-text-muted ${messageIndent}`}>
          {hint}
        </p>
      )}
    </div>
  );
}

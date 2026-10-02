import { type ComponentPropsWithRef, type ReactNode, useId } from "react";
import {
  assertAccessibleName,
  isBlank,
  type NonEmpty,
} from "../../accessibility/accessible-name.ts";

export type InputSize = "sm" | "md" | "lg";
export type InputType = "text" | "search" | "email" | "url" | "password";

export type InputProps<Label extends string = string> = Omit<
  ComponentPropsWithRef<"input">,
  | "className"
  | "style"
  | "children"
  | "size"
  | "type"
  | "id"
  | "role"
  | "aria-label"
  | "aria-labelledby"
  | "aria-describedby"
  | "aria-invalid"
  | "aria-hidden"
  | "hidden"
  | "inert"
  | "title"
> & {
  /** The field's name, shown above it and read by screen readers. Required and non-empty, like IconButton's. */
  readonly label: NonEmpty<Label>;
  /** Hide the label visually (a search box with a clear placeholder); it still names the field. */
  readonly hideLabel?: boolean;
  readonly type?: InputType;
  /** Measured in the mockups: sm 28 (title-bar search, 26 normalised up) · md 36 (form fields) · lg 44 (page level). */
  readonly size?: InputSize;
  /** Decorative leading icon (a folder, a magnifier); the label names the field. */
  readonly icon?: ReactNode;
  /** Helps fill it in; read after the label. */
  readonly hint?: string;
  /**
   * What is wrong with the value. Its presence marks the field invalid; it is read before the hint. An error that
   * appears after submit is not announced by the field itself: the form moves focus to the first invalid field.
   */
  readonly error?: string;
};

// Resting edge border-field (3:1 on every surface, see theme.css), hover a step lighter, focus the violet ring
// outside the edge: the three are always distinguishable. Invalid swaps the edge for the failure colour.
const FIELD =
  "w-full rounded-control border border-border-field bg-surface text-text-primary transition-colors " +
  "placeholder:text-text-muted " +
  "enabled:not-read-only:not-aria-invalid:hover:border-border-field-hover " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring " +
  "aria-invalid:border-field-invalid " +
  // Read-only is still a field (focusable, selectable) and keeps its 3:1 edge, but looks non-editable: a dashed
  // edge and the inset background. The value stays primary text, so it never looks like a placeholder. Scoped to
  // enabled fields (CSS :read-only also matches disabled ones).
  "enabled:read-only:border-dashed enabled:read-only:bg-inset " +
  // Chromium draws its own unstyled clear button in search fields; the design has none.
  "[&::-webkit-search-cancel-button]:appearance-none " +
  "disabled:cursor-not-allowed disabled:opacity-disabled";

const SIZE: Record<
  InputSize,
  { readonly field: string; readonly withIcon: string; readonly icon: string }
> = {
  // Icon and text insets measured: sm as the title-bar search (4: icon 12, text ~33), lg as the project path
  // (3: icon 16, text ~40).
  sm: { field: "h-7 px-3 text-sm", withIcon: "pl-8", icon: "left-3 [&_svg]:size-3.5" },
  md: { field: "h-9 px-3 text-md", withIcon: "pl-9", icon: "left-3 [&_svg]:size-4" },
  lg: { field: "h-11 px-4 text-md", withIcon: "pl-10", icon: "left-4 [&_svg]:size-4" },
};

/**
 * A single-line text field with its label and, optionally, a hint and an error. The label is required (a nameless
 * field is announced as just "edit text"), and the name, description and validity come only from these props.
 */
export function Input<Label extends string>({
  label,
  hideLabel = false,
  type = "text",
  size = "md",
  icon,
  hint,
  error,
  ...rest
}: InputProps<Label>) {
  assertAccessibleName(label, "Input");
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasError = error !== undefined && !isBlank(error);
  const hasHint = hint !== undefined && !isBlank(hint);
  const describedBy = [hasError ? errorId : null, hasHint ? hintId : null].filter(
    (x) => x !== null,
  );
  const sizing = SIZE[size];

  return (
    <div className="flex w-full flex-col gap-1.5">
      <label
        htmlFor={id}
        className={hideLabel ? "sr-only" : "text-sm font-medium text-text-primary"}
      >
        {label}
      </label>
      <div className="relative flex items-center">
        {icon !== undefined && icon !== null && (
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inline-flex text-text-muted ${sizing.icon}`}
          >
            {icon}
          </span>
        )}
        <input
          {...rest}
          type={type}
          id={id}
          // Set after the spread on purpose: JSX does not type-check hyphenated attributes, so these could still be
          // passed in. The name, description and validity come only from label, hint and error.
          aria-label={undefined}
          aria-labelledby={undefined}
          aria-hidden={undefined}
          aria-description={undefined}
          aria-errormessage={undefined}
          aria-readonly={undefined}
          aria-disabled={undefined}
          aria-required={undefined}
          hidden={undefined}
          inert={undefined}
          title={undefined}
          role={undefined}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy.length > 0 ? describedBy.join(" ") : undefined}
          className={`${FIELD} ${sizing.field}${icon !== undefined && icon !== null ? ` ${sizing.withIcon}` : ""}`}
        />
      </div>
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

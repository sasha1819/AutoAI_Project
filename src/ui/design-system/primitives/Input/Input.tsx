import type { ComponentPropsWithRef } from "react";
import type { NonEmpty } from "../../accessibility/accessible-name.ts";
import { FIELD_HEIGHT, FIELD_LOOK, FieldFrame, type FieldSize } from "../_field/index.ts";
import { Icon, type IconGlyph, type IconSize } from "../Icon/index.ts";

export type InputSize = FieldSize;
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
  readonly icon?: IconGlyph;
  /** Helps fill it in; read after the label. */
  readonly hint?: string;
  /**
   * What is wrong with the value. Its presence marks the field invalid; it is read before the hint. An error that
   * appears after submit is not announced by the field itself: the form moves focus to the first invalid field.
   */
  readonly error?: string;
};

// The shared field look (field-frame.tsx), plus what only a text field has.
const TEXT_FIELD =
  `${FIELD_LOOK} w-full ` +
  "placeholder:text-text-muted " +
  "enabled:not-read-only:not-aria-invalid:hover:border-border-field-hover " +
  // Read-only is still a field (focusable, selectable) and keeps its 3:1 edge, but looks non-editable: a dashed
  // edge and the sunken background. The value stays primary text, so it never looks like a placeholder. Scoped to
  // enabled fields (CSS :read-only also matches disabled ones).
  "enabled:read-only:border-dashed enabled:read-only:bg-sunken " +
  // Chromium draws its own unstyled clear button in search fields; the design has none.
  "[&::-webkit-search-cancel-button]:appearance-none";

const SIZE: Record<
  InputSize,
  {
    readonly field: string;
    readonly withIcon: string;
    readonly icon: string;
    readonly iconSize: IconSize;
  }
> = {
  // Icon and text insets measured: sm as the title-bar search (4: icon 12, text ~33), lg as the project path
  // (3: icon 16, text ~40).
  sm: { field: `${FIELD_HEIGHT.sm} px-3`, withIcon: "pl-8", icon: "left-3", iconSize: "sm" },
  md: { field: `${FIELD_HEIGHT.md} px-3`, withIcon: "pl-9", icon: "left-3", iconSize: "md" },
  lg: { field: `${FIELD_HEIGHT.lg} px-4`, withIcon: "pl-10", icon: "left-4", iconSize: "md" },
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
  const sizing = SIZE[size];
  return (
    <FieldFrame label={label} hideLabel={hideLabel} hint={hint} error={error} component="Input">
      {(field) => (
        <div className="relative flex items-center">
          {icon !== undefined && (
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inline-flex text-text-muted ${sizing.icon}`}
            >
              <Icon glyph={icon} decorative size={sizing.iconSize} />
            </span>
          )}
          <input
            {...rest}
            type={type}
            id={field.id}
            // Set after the spread on purpose: JSX does not type-check hyphenated attributes, so these could still
            // be passed in. The name, description and validity come only from label, hint and error.
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
            aria-invalid={field.invalid || undefined}
            aria-describedby={field.describedBy}
            className={`${TEXT_FIELD} ${sizing.field}${icon !== undefined ? ` ${sizing.withIcon}` : ""}`}
          />
        </div>
      )}
    </FieldFrame>
  );
}

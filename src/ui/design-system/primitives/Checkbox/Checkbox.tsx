import * as RadixCheckbox from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { useState } from "react";
import type { NonEmpty } from "../../accessibility/accessible-name.ts";
import { FIELD_STATES, FieldFrame } from "../_field/index.ts";

/** "indeterminate": some, not all, of what it stands for is checked (e.g. a select-all over a list). */
export type CheckboxState = boolean | "indeterminate";

/**
 * A closed set of props on purpose: nothing is spread onto the control, so no attribute passed in (aria-label,
 * aria-describedby, aria-hidden, …) can rename, re-describe, hide or misstate it.
 */
export type CheckboxProps<Label extends string = string> = {
  /** Shown beside the box and read by screen readers. Required and non-empty, like every form control's. */
  readonly label: NonEmpty<Label>;
  /** Hide the label visually (e.g. a row checkbox in a table whose row says what it is); it still names the box. */
  readonly hideLabel?: boolean;
  /** Controlled state; pair with onCheckedChange. */
  readonly checked?: CheckboxState;
  readonly defaultChecked?: CheckboxState;
  readonly onCheckedChange?: (checked: CheckboxState) => void;
  readonly disabled?: boolean;
  readonly required?: boolean;
  /** For form submission. */
  readonly name?: string;
  readonly value?: string;
  readonly hint?: string;
  /** What is wrong (e.g. a required confirmation not given). Marks it invalid; read before the hint. */
  readonly error?: string;
};

// Unchecked: the field edge and surface, like every form control. Checked or mixed: the violet fill with a white
// mark (4.9:1), as the mockups draw a selected radio (5) and an "on" switch (8). Hover only when it can act.
// The after: layer widens the click target to 24px (WCAG 2.5.8) without changing the 16px box, which matters most
// with a hidden label (e.g. a row checkbox in a dense table).
const BOX =
  `${FIELD_STATES} relative inline-flex size-4 shrink-0 items-center justify-center rounded-tag ` +
  "after:absolute after:-inset-1 " +
  "[&_svg]:size-3 [&_svg]:stroke-3";
const UNCHECKED =
  "border-border-field bg-surface enabled:not-aria-invalid:hover:border-border-field-hover";
const CHECKED =
  "border-accent bg-accent text-text-on-accent " +
  "enabled:not-aria-invalid:hover:border-accent-hover enabled:hover:bg-accent-hover";

/** A single on/off (or mixed) choice with its label beside it. Behaviour from Radix, look from tokens. */
export function Checkbox<Label extends string>({
  label,
  hideLabel = false,
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  required = false,
  name,
  value,
  hint,
  error,
}: CheckboxProps<Label>) {
  // Kept here so the right mark and colours show whether or not the parent controls the state.
  const [own, setOwn] = useState<CheckboxState>(defaultChecked);
  const state = checked ?? own;
  return (
    <FieldFrame
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
      component="Checkbox"
      layout="inline"
      disabled={disabled}
      width="hug"
    >
      {(field) => (
        <RadixCheckbox.Root
          id={field.id}
          aria-labelledby={field.labelId}
          aria-describedby={field.describedBy}
          aria-invalid={field.invalid || undefined}
          checked={state}
          onCheckedChange={(next) => {
            if (checked === undefined) setOwn(next);
            onCheckedChange?.(next);
          }}
          disabled={disabled}
          required={required}
          {...(name !== undefined ? { name } : {})}
          {...(value !== undefined ? { value } : {})}
          className={`${BOX} ${state === false ? UNCHECKED : CHECKED}`}
        >
          <RadixCheckbox.Indicator className="inline-flex">
            {state === "indeterminate" ? (
              <Minus aria-hidden="true" />
            ) : (
              <Check aria-hidden="true" />
            )}
          </RadixCheckbox.Indicator>
        </RadixCheckbox.Root>
      )}
    </FieldFrame>
  );
}

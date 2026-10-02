import * as RadixSwitch from "@radix-ui/react-switch";
import type { NonEmpty } from "../../accessibility/accessible-name.ts";
import { FIELD_STATES, FieldFrame } from "../_field/index.ts";

/**
 * A closed set of props on purpose: nothing is spread onto the control, so no attribute passed in can rename,
 * re-describe, hide or misstate it.
 */
export type SwitchProps<Label extends string = string> = {
  /** Shown beside the switch and read by screen readers. Required and non-empty, like every form control's. */
  readonly label: NonEmpty<Label>;
  /** Hide the label visually (a list row whose title already says what it switches); it still names the switch. */
  readonly hideLabel?: boolean;
  readonly checked?: boolean;
  readonly defaultChecked?: boolean;
  readonly onCheckedChange?: (checked: boolean) => void;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly name?: string;
  readonly value?: string;
  readonly hint?: string;
  readonly error?: string;
};

// Measured in mockup 8: a 38x22 track, an 18px white thumb inset 2px that travels 16px. On: the violet track (the
// closed violet list in ARCHITECTURE §7). Off: drawn in a dark grey with no edge; here the shared field edge (3:1, like
// every form control) around the raised fill, and the same white thumb.
const TRACK =
  `${FIELD_STATES} group relative inline-flex h-5.5 w-9.5 shrink-0 items-center rounded-full px-px ` +
  "after:absolute after:-inset-1 " +
  // State from the switch's own aria-checked (not the data-state attribute, which would need an arbitrary variant that tokens:check refuses).
  // Edge colours are guarded with not-aria-invalid, so only the invalid edge (FIELD_STATES) sets it when invalid.
  "not-aria-invalid:not-aria-checked:border-border-field not-aria-checked:bg-raised " +
  "enabled:not-aria-invalid:not-aria-checked:hover:border-border-field-hover " +
  "not-aria-invalid:aria-checked:border-accent aria-checked:bg-accent " +
  "enabled:not-aria-invalid:aria-checked:hover:border-accent-hover enabled:aria-checked:hover:bg-accent-hover";
const THUMB =
  "pointer-events-none block size-4.5 rounded-full bg-text-on-accent transition-transform motion-reduce:transition-none " +
  "group-aria-checked:translate-x-4";

/** An on/off setting that takes effect at once, with its label beside it. Behaviour from Radix, look from tokens. */
export function Switch<Label extends string>({
  label,
  hideLabel = false,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled = false,
  required = false,
  name,
  value,
  hint,
  error,
}: SwitchProps<Label>) {
  return (
    <FieldFrame
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
      component="Switch"
      layout="inline"
      disabled={disabled}
      width="hug"
      controlWidth="switch"
    >
      {(field) => (
        <RadixSwitch.Root
          id={field.id}
          aria-labelledby={field.labelId}
          aria-describedby={field.describedBy}
          aria-invalid={field.invalid || undefined}
          disabled={disabled}
          required={required}
          {...(checked !== undefined ? { checked } : {})}
          {...(defaultChecked !== undefined ? { defaultChecked } : {})}
          {...(onCheckedChange !== undefined ? { onCheckedChange } : {})}
          {...(name !== undefined ? { name } : {})}
          {...(value !== undefined ? { value } : {})}
          className={TRACK}
        >
          <RadixSwitch.Thumb className={THUMB} />
        </RadixSwitch.Root>
      )}
    </FieldFrame>
  );
}

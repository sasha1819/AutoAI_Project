import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { Icon, type IconSize } from "../Icon/index.ts";
import { isBlank, type NonEmpty } from "../../accessibility/accessible-name.ts";
import { FIELD_HEIGHT, FIELD_LOOK, FieldFrame, type FieldSize } from "../_field/index.ts";
import {
  LIST_MAX_HEIGHT,
  LIST_PANEL,
  LIST_ROW,
  LIST_ROW_INDICATOR,
  LIST_SCROLL_BUTTON,
} from "../_list/index.ts";

export type SelectOption = {
  /** What onValueChange receives. Non-empty and unique within the list. */
  readonly value: string;
  /** What a person sees and a screen reader reads. Non-empty. */
  readonly label: string;
  readonly disabled?: boolean;
};

export type SelectSize = FieldSize;

/**
 * A closed set of props on purpose: nothing is spread onto the control, so no attribute passed in (aria-label,
 * aria-describedby, aria-hidden, …) can rename, re-describe, hide or misstate it. Name, description and validity
 * come only from label, hint and error.
 */
export type SelectProps<Label extends string = string> = {
  /** The select's name, shown above it. Required and non-empty, like Input's and IconButton's. */
  readonly label: NonEmpty<Label>;
  readonly hideLabel?: boolean;
  readonly options: readonly SelectOption[];
  /** Controlled value; pair with onValueChange. "" means nothing chosen (shows the placeholder), e.g. after a reset. */
  readonly value?: string;
  readonly defaultValue?: string;
  readonly onValueChange?: (value: string) => void;
  /** Shown while nothing is chosen. A blank one falls back to the default. */
  readonly placeholder?: string;
  /** Shown (in a disabled select) when there are no options at all. A blank one falls back to the default. */
  readonly emptyText?: string;
  /**
   * fill: as wide as its container (forms) · hug: as wide as its value, the chevron right after it (a toolbar
   * filter, mockup 6). Pair hug with hideLabel when the value says enough.
   */
  readonly width?: "fill" | "hug";
  /** Same heights as Input, so the two line up in a form: sm 28 (toolbars) · md 36 · lg 44. */
  readonly size?: SelectSize;
  readonly disabled?: boolean;
  readonly required?: boolean;
  /** For form submission: Radix renders a hidden native select with this name. */
  readonly name?: string;
  readonly hint?: string;
  /** What is wrong with the choice. Marks the select invalid; read before the hint. */
  readonly error?: string;
  /** Opens the list on first render. For stories showing the open state: in a screen it would move focus on load. */
  readonly defaultOpen?: boolean;
};

const TRIGGER =
  "group inline-flex items-center px-3 text-left " +
  "enabled:not-aria-invalid:hover:border-border-field-hover aria-expanded:border-border-field-hover " +
  "data-placeholder:text-text-muted";

const WIDTH: Record<"fill" | "hug", string> = {
  fill: "w-full justify-between gap-2",
  hug: "w-auto justify-start gap-1.5",
};

const CHEVRON: Record<SelectSize, IconSize> = { sm: "sm", md: "md", lg: "md" };

// The list look is shared (../_list); Select adds Radix's size limits: no taller than the window allows, no
// narrower than the trigger.
const CONTENT = `${LIST_PANEL} max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width)`;

/**
 * Options a person can tell apart and pick: every label and value non-blank, values unique, labels unique (two
 * options that read the same cannot be told apart, by eye or by ear), and any given value one of them (otherwise
 * the trigger would show nothing at all).
 */
function assertUsableOptions(
  options: readonly SelectOption[],
  given: readonly (string | undefined)[],
): void {
  const values = new Set<string>();
  const labels = new Set<string>();
  for (const option of options) {
    if (isBlank(option.label) || isBlank(option.value)) {
      throw new Error("Select option needs a non-empty label and value");
    }
    const spoken = option.label.trim().toLowerCase();
    if (values.has(option.value))
      throw new Error(`Select option value "${option.value}" is used twice`);
    if (labels.has(spoken)) throw new Error(`Select option label "${option.label}" is used twice`);
    values.add(option.value);
    labels.add(spoken);
  }
  for (const value of given) {
    // "" is "nothing chosen": the only way to clear a controlled select back to its placeholder.
    if (value !== undefined && value !== "" && !values.has(value)) {
      throw new Error(`Select value "${value}" is not one of its option values`);
    }
  }
}

/** Picks one value from a short list. Keyboard and screen-reader behaviour come from Radix; the look from tokens. */
export function Select<Label extends string>({
  label,
  hideLabel = false,
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Choose one",
  emptyText = "Nothing to choose from",
  size = "md",
  width = "fill",
  disabled = false,
  required = false,
  name,
  hint,
  error,
  defaultOpen,
}: SelectProps<Label>) {
  assertUsableOptions(options, [value, defaultValue]);
  const empty = options.length === 0;
  const shownPlaceholder = isBlank(placeholder) ? "Choose one" : placeholder;
  const shownEmptyText = isBlank(emptyText) ? "Nothing to choose from" : emptyText;
  return (
    <FieldFrame
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
      component="Select"
      width={width}
      // A label click would open the list only sometimes (Radix opens on click for non-mouse pointers only).
      labelClickFocuses={false}
    >
      {(field) => (
        <RadixSelect.Root
          disabled={disabled || empty}
          required={required}
          {...(value !== undefined ? { value } : {})}
          {...(defaultValue !== undefined ? { defaultValue } : {})}
          {...(onValueChange !== undefined ? { onValueChange } : {})}
          {...(name !== undefined ? { name } : {})}
          {...(defaultOpen !== undefined ? { defaultOpen } : {})}
        >
          <RadixSelect.Trigger
            id={field.id}
            aria-labelledby={field.labelId}
            aria-describedby={field.describedBy}
            aria-invalid={field.invalid || undefined}
            className={`${FIELD_LOOK} ${FIELD_HEIGHT[size]} ${TRIGGER} ${WIDTH[width]}`}
          >
            <span className="truncate">
              <RadixSelect.Value placeholder={empty ? shownEmptyText : shownPlaceholder} />
            </span>
            <RadixSelect.Icon
              className={`inline-flex shrink-0 text-text-muted transition-transform group-aria-expanded:rotate-180`}
            >
              <Icon glyph={ChevronDown} decorative size={CHEVRON[size]} />
            </RadixSelect.Icon>
          </RadixSelect.Trigger>
          <RadixSelect.Portal>
            <RadixSelect.Content
              position="popper"
              sideOffset={4}
              className={CONTENT}
              // The list is named like its select, so a screen reader landing in it knows what it is choosing.
              aria-labelledby={field.labelId}
            >
              <RadixSelect.ScrollUpButton className={LIST_SCROLL_BUTTON}>
                <Icon glyph={ChevronUp} decorative size="sm" />
              </RadixSelect.ScrollUpButton>
              <RadixSelect.Viewport className={LIST_MAX_HEIGHT}>
                {options.map((option) => (
                  <RadixSelect.Item
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled === true}
                    className={LIST_ROW}
                  >
                    <RadixSelect.ItemIndicator className={LIST_ROW_INDICATOR}>
                      <Icon glyph={Check} decorative size="sm" />
                    </RadixSelect.ItemIndicator>
                    <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                  </RadixSelect.Item>
                ))}
              </RadixSelect.Viewport>
              <RadixSelect.ScrollDownButton className={LIST_SCROLL_BUTTON}>
                <Icon glyph={ChevronDown} decorative size="sm" />
              </RadixSelect.ScrollDownButton>
            </RadixSelect.Content>
          </RadixSelect.Portal>
        </RadixSelect.Root>
      )}
    </FieldFrame>
  );
}

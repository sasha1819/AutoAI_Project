import * as RadixTabs from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import {
  assertAccessibleName,
  isBlank,
  nameKey,
  type NonEmpty,
} from "../../accessibility/accessible-name.ts";

export type TabItem<Value extends string = string> = {
  readonly value: Value;
  /** The tab's name. Non-blank and unique (checked at runtime: items usually come from data). */
  readonly label: string;
  /** The panel shown while this tab is selected. Only the selected panel is rendered. */
  readonly content: ReactNode;
  /** A neutral count after the label ("Issues 1"); part of the tab's name. A whole number of 0 or more. */
  readonly count?: number;
  readonly disabled?: boolean;
};

/** default: section tabs (mockup 7: 13px, 40 tall). caps: compact panel tabs (mockup 4 run log: 11px caps, 32 tall). */
export type TabsLook = "default" | "caps";

type TabsBase<Value extends string, Label extends string> = {
  /** Names the tab list for screen readers ("Run details"). Not shown. */
  readonly label: NonEmpty<Label>;
  readonly items: readonly TabItem<Value>[];
  readonly look?: TabsLook;
};

/** Controlled (value with onValueChange, or the tabs could never change) or uncontrolled (defaultValue), not both. */
export type TabsProps<Value extends string = string, Label extends string = string> = TabsBase<
  Value,
  Label
> &
  (
    | {
        readonly value: NoInfer<Value>;
        readonly onValueChange: (value: NoInfer<Value>) => void;
        readonly defaultValue?: never;
      }
    | {
        readonly value?: never;
        /** The first selection; defaults to the first tab that is not disabled. */
        readonly defaultValue?: NoInfer<Value>;
        readonly onValueChange?: (value: NoInfer<Value>) => void;
      }
  );

const LIST: Record<TabsLook, string> = {
  default: "gap-4",
  caps: "gap-5",
};

// The active tab: primary text and the violet underline (ARCHITECTURE §7, use 4), as wide as the tab's content
// (label, and its count if it has one). Each tab has 4px of side padding cancelled by a negative margin, so the
// layout and underline match the mockup while the focus ring, drawn just inside the tab, clears the label.
// Keyboard focus: the violet ring (use 3). Hover only when it can act.
const TRIGGER_BASE =
  "relative -mx-1 flex shrink-0 cursor-default px-1 items-center gap-1.5 whitespace-nowrap rounded-tag text-text-secondary " +
  "after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:rounded-full " +
  "aria-selected:text-text-primary aria-selected:after:bg-accent-strong " +
  "enabled:not-aria-selected:hover:text-text-primary " +
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring " +
  "disabled:cursor-not-allowed disabled:opacity-disabled";
const TRIGGER: Record<TabsLook, string> = {
  default: "h-10 text-md",
  caps: "h-8 text-xs uppercase tracking-wide",
};
// The selected label is semibold; a hidden bold copy reserves its width so switching tabs never shifts the row.
// Class names written out in full: Tailwind only builds what it finds literally in the source.
const WEIGHT: Record<TabsLook, { readonly label: string; readonly reserve: string }> = {
  default: {
    label: "font-medium group-aria-selected:font-semibold",
    reserve: "font-semibold",
  },
  caps: { label: "font-semibold", reserve: "font-semibold" },
};

/** Checks the tabs and returns the first enabled one (the default selection). */
function checkItems<Value extends string>(items: readonly TabItem<Value>[]): Value {
  if (items.length === 0) throw new Error("Tabs needs at least one tab");
  const values = new Set<string>();
  const labels = new Set<string>();
  for (const item of items) {
    if (isBlank(item.label)) throw new Error("Tabs: every tab needs a non-blank label");
    if (isBlank(item.value)) throw new Error("Tabs: every tab needs a non-blank value");
    const key = nameKey(item.label);
    if (item.count !== undefined && !(Number.isInteger(item.count) && item.count >= 0)) {
      throw new Error(
        `Tabs: a count must be a whole number of 0 or more, got ${String(item.count)}`,
      );
    }
    if (values.has(item.value)) throw new Error(`Tabs: the value "${item.value}" is used twice`);
    if (labels.has(key)) throw new Error(`Tabs: the label "${item.label}" is used twice`);
    values.add(item.value);
    labels.add(key);
  }
  const first = items.find((i) => i.disabled !== true);
  if (first === undefined) throw new Error("Tabs: at least one tab must be enabled");
  return first.value;
}

/**
 * Tabs on Radix: arrow keys move between tabs and select them (disabled tabs are skipped), Home/End jump to the
 * ends, Tab moves into the panel. A closed set of props; nothing is spread onto the elements.
 */
export function Tabs<Value extends string, Label extends string>({
  label,
  items,
  value,
  defaultValue,
  onValueChange,
  look = "default",
}: TabsProps<Value, Label>) {
  assertAccessibleName(label, "Tabs");
  const first = checkItems(items);
  for (const v of [value, defaultValue]) {
    if (v !== undefined && !items.some((i) => i.value === v))
      throw new Error(`Tabs: "${v}" is not one of the tabs`);
  }
  const weight = WEIGHT[look];
  return (
    <RadixTabs.Root
      {...(value === undefined ? { defaultValue: defaultValue ?? first } : { value })}
      onValueChange={(next) => {
        const picked = items.find((i) => i.value === next);
        if (picked !== undefined) onValueChange?.(picked.value);
      }}
      className="flex min-w-0 flex-col"
    >
      {/* The divider sits on a wrapper that does not scroll; the scrolling row overlaps it by 1px, so the selected
          tab's underline covers it, and nothing a tab draws is clipped (the focus ring is drawn inside the tab). */}
      <div className="min-w-0 border-b border-border-default">
        <RadixTabs.List
          aria-label={label}
          className={`relative -mx-1 -mb-px flex min-w-0 overflow-x-auto px-1 ${LIST[look]}`}
        >
          {items.map((item) => (
            <RadixTabs.Trigger
              key={item.value}
              value={item.value}
              disabled={item.disabled === true}
              className={`group ${TRIGGER_BASE} ${TRIGGER[look]}`}
            >
              <span className="grid">
                <span className={`col-start-1 row-start-1 ${weight.label}`}>{item.label}</span>
                <span
                  aria-hidden="true"
                  className={`invisible col-start-1 row-start-1 ${weight.reserve}`}
                >
                  {item.label}
                </span>
              </span>
              {/* The space keeps the name "Issues 1", not "Issues1"; a flex row does not draw it. */}
              {item.count !== undefined && " "}
              {item.count !== undefined && (
                <span className="min-w-4 rounded-full bg-raised px-1.5 text-center text-xs font-semibold text-text-secondary tabular-nums">
                  {item.count}
                </span>
              )}
            </RadixTabs.Trigger>
          ))}
        </RadixTabs.List>
      </div>
      {items.map((item) => (
        <RadixTabs.Content
          key={item.value}
          value={item.value}
          className="min-w-0 rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          {item.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}

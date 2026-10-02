import { type KeyboardEvent, type ReactNode, useId, useRef } from "react";
import {
  assertAccessibleName,
  isBlank,
  type NonEmpty,
} from "../../accessibility/accessible-name.ts";
import { EmptyState } from "../../primitives/EmptyState/index.ts";

export type SidebarItem<Id extends string = string> = {
  /** Unique within the list. */
  readonly id: Id;
  /** The row's content (a StepRow, a test name and its requirement): its text is the option's name. */
  readonly content: ReactNode;
  readonly disabled?: boolean;
};

export type SidebarListProps<
  Id extends string = string,
  Label extends string = string,
  Empty extends string = string,
> = {
  /** Names the list ("Steps", "Test cases"). */
  readonly label: NonEmpty<Label>;
  /** Shows the label above the list as a caps heading (mockup 7 "STEPS", mockup 4 "TEST CASES"). */
  readonly showLabel?: boolean;
  readonly items: readonly SidebarItem<Id>[];
  /** The selected row (the one whose details are shown), if any. */
  readonly selectedId: NoInfer<Id> | undefined;
  readonly onSelect: (id: NoInfer<Id>) => void;
  /** Said when there are no rows. */
  readonly emptyText: NonEmpty<Empty>;
  /** The shown label's heading level in the page outline (default 2). */
  readonly headingLevel?: 2 | 3;
};

// Selected: the selected fill (mockup 4's test list); hover only when it can act; the keyboard focus is the inset
// violet outline the Select list uses (ARCHITECTURE §7, use 3), drawn inside so a scrolling sidebar never clips it.
const OPTION =
  "flex min-w-0 cursor-default items-center px-4 select-none " +
  "aria-selected:bg-selected not-aria-selected:not-aria-disabled:hover:bg-hover " +
  "focus-visible:inset-ring-1 focus-visible:inset-ring-focus-ring aria-disabled:opacity-disabled";

/**
 * A single-select list for a sidebar (APG listbox): one Tab stop; the arrow keys move and select (disabled rows are
 * skipped), Home and End jump to the ends; a click selects. The screen shows the selected row's details elsewhere.
 * A closed set of props; nothing spread.
 */
export function SidebarList<Id extends string, Label extends string, Empty extends string>({
  label,
  showLabel = false,
  items,
  selectedId,
  onSelect,
  emptyText,
  headingLevel = 2,
}: SidebarListProps<Id, Label, Empty>) {
  assertAccessibleName(label, "SidebarList");
  assertAccessibleName(emptyText, "SidebarList empty text");
  const ids = items.map((i) => i.id);
  if (ids.some(isBlank)) throw new Error("SidebarList: every row needs a non-blank id");
  if (new Set(ids).size !== ids.length) throw new Error("SidebarList: two rows have the same id");
  if (selectedId !== undefined && !ids.includes(selectedId)) {
    throw new Error(`SidebarList: the selected id "${selectedId}" is not a row`);
  }
  const labelId = useId();
  const options = useRef(new Map<string, HTMLLIElement>());
  const enabled = items.filter((i) => i.disabled !== true);
  if (items.length > 0 && enabled.length === 0) {
    throw new Error("SidebarList: at least one row must be enabled, or the list cannot be reached");
  }
  const Heading = headingLevel === 3 ? "h3" : "h2";
  // The one Tab stop: the selected row, else the first enabled one.
  const tabStop = enabled.some((i) => i.id === selectedId) ? selectedId : enabled[0]?.id;

  const moveTo = (id: Id | undefined) => {
    if (id === undefined) return;
    onSelect(id);
    options.current.get(id)?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLLIElement>, id: Id) => {
    const at = enabled.findIndex((i) => i.id === id);
    const next: Record<string, Id | undefined> = {
      ArrowDown: enabled[Math.min(at + 1, enabled.length - 1)]?.id,
      ArrowUp: enabled[Math.max(at - 1, 0)]?.id,
      Home: enabled[0]?.id,
      End: enabled.at(-1)?.id,
    };
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      moveTo(id);
    } else if (Object.hasOwn(next, event.key)) {
      event.preventDefault();
      moveTo(next[event.key]);
    }
  };

  return (
    <div className="flex min-w-0 flex-col">
      {showLabel && (
        <Heading
          id={labelId}
          className="flex h-8 items-center px-4 text-xs font-semibold tracking-wide text-text-secondary uppercase"
        >
          {label}
        </Heading>
      )}
      {items.length === 0 ? (
        <div className="py-6">
          <EmptyState size="compact" title={emptyText} />
        </div>
      ) : (
        <ul
          role="listbox"
          {...(showLabel ? { "aria-labelledby": labelId } : { "aria-label": label })}
          className="flex min-w-0 flex-col"
        >
          {items.map((item) => {
            const disabled = item.disabled === true;
            return (
              <li
                key={item.id}
                ref={(el) => {
                  if (el === null) options.current.delete(item.id);
                  else options.current.set(item.id, el);
                }}
                role="option"
                aria-selected={item.id === selectedId}
                aria-disabled={disabled || undefined}
                tabIndex={item.id === tabStop ? 0 : -1}
                className={OPTION}
                // A disabled row never takes focus, so the keys keep working from the row that has it.
                onMouseDown={(event) => {
                  if (disabled) event.preventDefault();
                }}
                onClick={() => {
                  if (!disabled) moveTo(item.id);
                }}
                onKeyDown={(event) => {
                  if (!disabled) onKeyDown(event, item.id);
                }}
              >
                {item.content}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import * as RadixPopover from "@radix-ui/react-popover";
import { type KeyboardEvent, type ReactElement, type ReactNode, useRef, useState } from "react";
import { assertAccessibleName, type NonEmpty } from "../../accessibility/accessible-name.ts";
import { tabbables } from "../../accessibility/tabbable.ts";
import { OVERLAY_SURFACE } from "../_overlay/index.ts";

export type PopoverWidth = "sm" | "md";

export type PopoverProps<Label extends string = string> = {
  /** Names the panel for screen readers ("Filter options"). Not shown: the panel's own content says the rest. */
  readonly label: NonEmpty<Label>;
  /**
   * The control that opens it: one Button or IconButton (it passes on the props and ref it gets). It is marked
   * aria-expanded and aria-haspopup="dialog".
   */
  readonly trigger: ReactElement;
  /**
   * The panel content: short forms, options, details. Not a menu of commands (that is a menu pattern). Long
   * content should be made of focusable rows: plain text below the last control cannot be scrolled to by keyboard.
   */
  readonly children: ReactNode;
  readonly side?: "top" | "right" | "bottom" | "left";
  readonly align?: "start" | "center" | "end";
  /** sm 256px · md 320px. */
  readonly width?: PopoverWidth;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  /** Story-only: opens it on first render. */
  readonly defaultOpen?: boolean;
};

const WIDTH: Record<PopoverWidth, string> = { sm: "w-64", md: "w-80" };
/** The control after `from` in page order, outside `skip` (the panel, which lives in a portal at the end). */
function nextAfter(from: HTMLElement, skip: HTMLElement): HTMLElement | undefined {
  const all = tabbables(document).filter((el) => !skip.contains(el));
  return all[all.indexOf(from) + 1];
}

/**
 * A non-modal panel anchored to its trigger (Radix): the page behind stays usable. Opening moves focus into the
 * panel. Escape closes it and focus goes back to the trigger; a click outside just closes it. Tabbing past either
 * end closes it and moves on in page order (back to the trigger, or to the control after it), since the panel
 * itself sits at the end of the page. A closed set of props; nothing is spread.
 */
export function Popover<Label extends string>({
  label,
  trigger,
  children,
  side = "bottom",
  align = "start",
  width = "sm",
  open,
  onOpenChange,
  defaultOpen,
}: PopoverProps<Label>) {
  assertAccessibleName(label, "Popover");
  const [ownOpen, setOwnOpen] = useState(defaultOpen ?? false);
  const isOpen = open ?? ownOpen;
  const setOpen = (next: boolean) => {
    if (open === undefined) setOwnOpen(next);
    onOpenChange?.(next);
  };
  const triggerRef = useRef<HTMLButtonElement>(null);
  const movedOn = useRef(false);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const panel = event.currentTarget;
    const inside = tabbables(panel);
    const atEdge = event.shiftKey
      ? inside.length === 0 ||
        document.activeElement === inside[0] ||
        document.activeElement === panel
      : inside.length === 0 || document.activeElement === inside.at(-1);
    const from = triggerRef.current;
    if (!atEdge || from === null) return;
    event.preventDefault();
    // Shift+Tab: Radix returns focus to the trigger on close. Tab: on to the control after the trigger.
    const next = event.shiftKey ? undefined : nextAfter(from, panel);
    movedOn.current = next !== undefined;
    setOpen(false);
    next?.focus();
  };

  return (
    <RadixPopover.Root open={isOpen} onOpenChange={setOpen}>
      <RadixPopover.Trigger asChild ref={triggerRef}>
        {trigger}
      </RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          aria-label={label}
          side={side}
          align={align}
          sideOffset={4}
          collisionPadding={8}
          onKeyDown={onKeyDown}
          onCloseAutoFocus={(event) => {
            // Focus already moved on to the next control: do not pull it back to the trigger.
            if (movedOn.current) event.preventDefault();
            movedOn.current = false;
          }}
          // Never taller than the space the window has left; the panel scrolls inside instead.
          className={`${OVERLAY_SURFACE} flex max-h-(--radix-popover-content-available-height) flex-col text-md text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${WIDTH[width]}`}
        >
          <div className="min-h-0 max-h-96 overflow-y-auto p-3">{children}</div>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

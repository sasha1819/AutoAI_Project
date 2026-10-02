import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { type ReactElement, type ReactNode, useRef } from "react";
import {
  assertAccessibleName,
  isBlank,
  type NonEmpty,
} from "../../accessibility/accessible-name.ts";
import { tabbables } from "../../accessibility/tabbable.ts";
import { OVERLAY_SURFACE } from "../_overlay/index.ts";
import { IconButton } from "../IconButton/index.ts";

export type ModalSize = "sm" | "md";

type Shared<Title extends string> = {
  /** Shown as the dialog's heading and its accessible name. */
  readonly title: NonEmpty<Title>;
  /** One or two sentences under the title; read when the dialog opens. */
  readonly description?: string;
  readonly children?: ReactNode;
  /** sm 400px (confirmations) · md 560px (short forms). */
  readonly size?: ModalSize;
};

/** Opened by its trigger; Escape, the backdrop, Close and any action wrapped in ModalClose close it. */
type Uncontrolled = {
  readonly trigger: ReactElement;
  readonly open?: never;
  /** Told when it opens or closes. */
  readonly onOpenChange?: (open: boolean) => void;
  readonly dismissible?: true;
  readonly actions?: ReactElement;
};

/** Opened and closed by the screen's own state: open and onOpenChange together, or it could not close. */
type Controlled = {
  readonly trigger?: ReactElement;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
} & (
  | { readonly dismissible?: true; readonly actions?: ReactElement }
  /** Only its actions close it (a step that must be answered): so actions are required. */
  | { readonly dismissible: false; readonly actions: ReactElement }
);

export type ModalProps<Title extends string = string> = Shared<Title> & (Uncontrolled | Controlled);

const WIDTH: Record<ModalSize, string> = { sm: "w-100", md: "w-140" };

/**
 * A modal dialog (Radix): focus moves inside and is kept there, the page behind is hidden from assistive tech,
 * inert and does not scroll, and when it closes focus returns to where it was (the trigger, or whatever opened it
 * through app state). Focus starts on the first control in the body or the actions, not on Close (last in reading
 * order, shown top-right); on the dialog itself when there is no other control or the first one is off-screen.
 * A closed set of props; nothing spread.
 */
export function Modal<Title extends string>(props: ModalProps<Title>) {
  const { title, description, children, actions, size = "sm", trigger, open, onOpenChange } = props;
  const dismissible = props.dismissible !== false;
  assertAccessibleName(title, "Modal");
  const help = description !== undefined && !isBlank(description) ? description : undefined;
  const hasBody =
    children !== undefined && children !== null && typeof children !== "boolean" && children !== "";
  const returnTo = useRef<HTMLElement | null>(null);
  const backdrop = useRef<HTMLDivElement>(null);

  return (
    <RadixDialog.Root
      {...(open === undefined ? {} : { open })}
      {...(onOpenChange === undefined ? {} : { onOpenChange })}
    >
      {trigger !== undefined && <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>}
      <RadixDialog.Portal>
        {/* The backdrop scrolls, so a tall dialog is never cut off. */}
        <RadixDialog.Overlay
          ref={backdrop}
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-scrim p-4"
        >
          <RadixDialog.Content
            {...(help === undefined ? { "aria-describedby": undefined } : {})}
            onOpenAutoFocus={(event) => {
              returnTo.current =
                document.activeElement instanceof HTMLElement ? document.activeElement : null;
              const dialog = event.currentTarget;
              if (!(dialog instanceof HTMLElement)) return;
              const first = tabbables(dialog)[0];
              // Only Close to focus (its label tooltip would take the first Escape), or the first control is below
              // the window (focusing it would skip the content above): focus the dialog, named by its title.
              const onlyClose = first === undefined || first.closest("[data-modal-close]") !== null;
              const offScreen =
                first !== undefined && first.getBoundingClientRect().bottom > window.innerHeight;
              if (onlyClose || offScreen) {
                event.preventDefault();
                dialog.focus();
              }
            }}
            onCloseAutoFocus={(event) => {
              // Radix returns focus to its own trigger; opened by app state, return it to whatever had it.
              if (trigger !== undefined) return;
              event.preventDefault();
              if (returnTo.current?.isConnected === true) returnTo.current.focus();
            }}
            onEscapeKeyDown={(event) => {
              if (!dismissible) event.preventDefault();
            }}
            onPointerDownOutside={(event) => {
              // Dragging the backdrop's scrollbar is not a click outside.
              const pointer = event.detail.originalEvent;
              const b = backdrop.current;
              const onScrollbar =
                b !== null &&
                pointer.target === b &&
                pointer.clientX >= b.getBoundingClientRect().left + b.clientWidth;
              if (!dismissible || onScrollbar) event.preventDefault();
            }}
            onInteractOutside={(event) => {
              if (!dismissible) event.preventDefault();
            }}
            // The ring shows when the dialog itself takes focus (only Close inside, or a long body).
            className={`${OVERLAY_SURFACE} relative flex max-w-full flex-col gap-5 p-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${WIDTH[size]}`}
          >
            <div className={`flex flex-col gap-1 ${dismissible ? "pr-8" : ""}`}>
              <RadixDialog.Title className="text-heading font-bold text-text-primary">
                {title}
              </RadixDialog.Title>
              {help !== undefined && (
                <RadixDialog.Description className="text-md text-text-secondary">
                  {help}
                </RadixDialog.Description>
              )}
            </div>
            {hasBody && <div className="text-md text-text-primary">{children}</div>}
            {actions !== undefined && (
              <div className="flex flex-wrap justify-end gap-2">{actions}</div>
            )}
            {dismissible && (
              <div data-modal-close="" className="absolute top-4 right-4">
                <RadixDialog.Close asChild>
                  <IconButton label="Close" icon={X} size="sm" />
                </RadixDialog.Close>
              </div>
            )}
          </RadixDialog.Content>
        </RadixDialog.Overlay>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** Makes one action close the Modal it is in ("Cancel", or "Save" once saved by its own onClick). Throws outside one. */
export function ModalClose({ children }: { readonly children: ReactElement }) {
  return <RadixDialog.Close asChild>{children}</RadixDialog.Close>;
}

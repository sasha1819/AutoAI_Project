import type { MouseEvent, MouseEventHandler } from "react";

// The look and press behaviour shared by Button and IconButton, so the two can never drift apart.

export type ButtonVariant = "primary" | "secondary" | "ghost";

export const BUTTON_BASE =
  "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-control transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring " +
  "disabled:cursor-not-allowed disabled:opacity-disabled aria-busy:cursor-progress";

// Hover and press feedback only when the button can act: not disabled, not busy.
export const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-text-on-accent " +
    "enabled:not-aria-busy:hover:bg-accent-hover enabled:not-aria-busy:active:bg-accent-pressed",
  secondary:
    "border border-border-strong bg-transparent text-text-primary " +
    "enabled:not-aria-busy:hover:bg-hover enabled:not-aria-busy:active:bg-raised",
  ghost:
    "bg-transparent text-text-secondary " +
    "enabled:not-aria-busy:hover:bg-hover enabled:not-aria-busy:hover:text-text-primary enabled:not-aria-busy:active:bg-raised",
};

/** A busy button must not start its action twice, nor submit its form again. */
export function pressHandler(
  loading: boolean,
  onClick: MouseEventHandler<HTMLButtonElement> | undefined,
): MouseEventHandler<HTMLButtonElement> {
  return (event: MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
}

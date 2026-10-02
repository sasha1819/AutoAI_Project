import { LoaderCircle } from "lucide-react";
import type { ComponentPropsWithRef, MouseEvent, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

export type ButtonProps = Omit<
  ComponentPropsWithRef<"button">,
  "className" | "style" | "children" | "aria-disabled"
> & {
  /** The visible label, which is also the button's accessible name. Icon-only actions use IconButton. */
  readonly children: ReactNode;
  /** primary: the one main action (violet); secondary: other actions; ghost: low-emphasis, text-like. */
  readonly variant?: ButtonVariant;
  /**
   * Heights measured in the mockups: sm 28 (toolbars, list rows; "+ Add" at 26 is normalised up) · md 30 (card
   * actions) · lg 40 (page actions; the 38px pair on the scan screen is normalised up) · xl 44 (onboarding).
   */
  readonly size?: ButtonSize;
  /**
   * Busy with the action it started: stays focusable and is announced as busy, but ignores presses and shows no
   * hover or press feedback. The only way to "disable but keep focus"; aria-disabled is not accepted on its own.
   */
  readonly loading?: boolean;
  /** Shown before the label; replaced by a spinner while loading. Decorative: the label names the button. */
  readonly icon?: ReactNode;
  /** Shown after the label, e.g. an arrow on a "next step" action. Decorative. */
  readonly trailingIcon?: ReactNode;
  readonly fullWidth?: boolean;
};

const BASE =
  "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-control transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring " +
  "disabled:cursor-not-allowed disabled:opacity-disabled aria-busy:cursor-progress";

// Hover and press feedback only when the button can act: not disabled, not busy.
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-accent font-semibold text-text-on-accent " +
    "enabled:not-aria-busy:hover:bg-accent-hover enabled:not-aria-busy:active:bg-accent-pressed",
  secondary:
    "border border-border-strong bg-transparent font-medium text-text-primary " +
    "enabled:not-aria-busy:hover:bg-hover enabled:not-aria-busy:active:bg-raised",
  ghost:
    "bg-transparent font-medium text-text-secondary " +
    "enabled:not-aria-busy:hover:bg-hover enabled:not-aria-busy:hover:text-text-primary enabled:not-aria-busy:active:bg-raised",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-7 gap-1.5 px-2.5 text-sm [&_svg]:size-3.5",
  md: "h-7.5 gap-2 px-3 text-sm [&_svg]:size-3.5",
  lg: "h-10 gap-2 px-4 text-md [&_svg]:size-4",
  xl: "h-11 gap-2 px-5 text-lg [&_svg]:size-4",
};

/** The button of the design system. Colours come from tokens only; screens pick a variant, never a colour. */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  trailingIcon,
  fullWidth = false,
  type = "button",
  onClick,
  children,
  ...rest
}: ButtonProps) {
  // TODO(M4): use the Spinner and Icon primitives once they exist (design review, Button).
  const lead = loading ? (
    <LoaderCircle className="animate-spin motion-reduce:animate-none" />
  ) : (
    icon
  );
  return (
    <button
      {...rest}
      type={type}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      className={`${BASE} ${VARIANT[variant]} ${SIZE[size]}${fullWidth ? " w-full" : ""}`}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        // A busy button must not start the action twice, nor submit its form again.
        if (loading) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {lead !== undefined && lead !== null && (
        <span aria-hidden="true" className="inline-flex">
          {lead}
        </span>
      )}
      {children}
      {trailingIcon !== undefined && trailingIcon !== null && (
        <span aria-hidden="true" className="inline-flex">
          {trailingIcon}
        </span>
      )}
    </button>
  );
}

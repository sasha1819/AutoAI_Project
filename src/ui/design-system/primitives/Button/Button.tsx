import type { ComponentPropsWithRef, ReactNode } from "react";
import { Icon, type IconGlyph, type IconSize } from "../Icon/index.ts";
import { BUTTON_BASE, BUTTON_VARIANT, type ButtonVariant, pressHandler } from "./button-look.ts";
import { Spinner } from "../Spinner/index.ts";

export type { ButtonVariant };

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
   * Busy with the action it started: stays focusable and is marked aria-busy, but ignores presses and shows no
   * hover or press feedback. The only way to "disable but keep focus"; aria-disabled is not accepted on its own.
   * Most screen readers do not announce a change of aria-busy: a screen that must say "saving…" uses a live region.
   */
  readonly loading?: boolean;
  /** Shown before the label; replaced by a spinner while loading. Decorative: the label names the button. */
  readonly icon?: IconGlyph;
  /** Shown after the label, e.g. an arrow on a "next step" action. Decorative. */
  readonly trailingIcon?: IconGlyph;
  readonly fullWidth?: boolean;
};

// A labelled primary action reads heavier than the others (measured in the mockups).
const WEIGHT: Record<ButtonVariant, string> = {
  primary: "font-semibold",
  secondary: "font-medium",
  ghost: "font-medium",
};

// The icons' size; the spinner takes the icon's place at the same size.
const ICON: Record<ButtonSize, IconSize & ("sm" | "md")> = {
  sm: "sm",
  md: "sm",
  lg: "md",
  xl: "md",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-7 gap-1.5 px-2.5 text-sm",
  md: "h-7.5 gap-2 px-3 text-sm",
  lg: "h-10 gap-2 px-4 text-md",
  xl: "h-11 gap-2 px-5 text-lg",
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
  const lead = loading ? (
    <Spinner decorative size={ICON[size]} />
  ) : icon === undefined ? undefined : (
    <Icon glyph={icon} decorative size={ICON[size]} />
  );
  return (
    <button
      {...rest}
      type={type}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      className={`${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${WEIGHT[variant]} ${SIZE[size]}${fullWidth ? " w-full" : ""}`}
      onClick={pressHandler(loading, onClick)}
    >
      {lead !== undefined && (
        <span aria-hidden="true" className="inline-flex">
          {lead}
        </span>
      )}
      {children}
      {trailingIcon !== undefined && (
        <span aria-hidden="true" className="inline-flex">
          <Icon glyph={trailingIcon} decorative size={ICON[size]} />
        </span>
      )}
    </button>
  );
}

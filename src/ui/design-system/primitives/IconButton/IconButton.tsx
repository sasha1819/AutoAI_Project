import { LoaderCircle } from "lucide-react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { assertAccessibleName, type NonEmpty } from "../../accessibility/accessible-name.ts";
import { BUTTON_BASE, BUTTON_VARIANT, type ButtonVariant, pressHandler } from "../Button/index.ts";

export type IconButtonSize = "sm" | "md";

export type IconButtonProps<Label extends string = string> = Omit<
  ComponentPropsWithRef<"button">,
  | "className"
  | "style"
  | "children"
  | "title"
  | "role"
  | "aria-label"
  | "aria-labelledby"
  | "aria-hidden"
  | "aria-disabled"
> & {
  /**
   * The accessible name, required: an icon alone tells a screen reader nothing. Say what the button does
   * ("Close", "Send message"), not what the icon shows.
   */
  readonly label: NonEmpty<Label>;
  /** The only visible content. Decorative: the label names the button. */
  readonly icon: ReactNode;
  /** Same three looks as Button: primary (the one main action), secondary (bordered), ghost (toolbar icons). */
  readonly variant?: ButtonVariant;
  /** Square, matching Button's heights so the two line up: sm 28 (send in chat) · md 30 (toolbars). */
  readonly size?: IconButtonSize;
  /**
   * Busy: the icon becomes a spinner; stays focusable and keeps its name, is marked aria-busy, ignores presses.
   * Most screen readers do not announce a change of aria-busy: if "sending…" must be spoken, the screen says so in a
   * live region (Toast / status pattern), not here.
   */
  readonly loading?: boolean;
};

const SIZE: Record<IconButtonSize, string> = {
  sm: "size-7 [&_svg]:size-3.5",
  md: "size-7.5 [&_svg]:size-4",
};

/**
 * A button whose only content is an icon. The label is its accessible name and must be non-empty: the type rejects
 * a missing or empty label, and a blank one built at runtime throws instead of rendering a nameless button.
 */
export function IconButton<Label extends string>({
  label,
  icon,
  variant = "ghost",
  size = "md",
  loading = false,
  type = "button",
  onClick,
  ...rest
}: IconButtonProps<Label>) {
  // TODO(M4): show the label in the Tooltip primitive once it exists, so mouse users can read it too.
  // TODO(M4): use the Spinner primitive once it exists (same as Button).
  assertAccessibleName(label, "IconButton");
  return (
    <button
      {...rest}
      type={type}
      // Set after the spread on purpose. JSX does not type-check hyphenated attributes, so these could still be
      // passed in: nothing may replace or blank the name, hide the button from assistive tech, or change its role.
      aria-label={label}
      aria-labelledby={undefined}
      aria-hidden={undefined}
      role={undefined}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      className={`${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${SIZE[size]}`}
      onClick={pressHandler(loading, onClick)}
    >
      <span aria-hidden="true" className="inline-flex">
        {loading ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : icon}
      </span>
    </button>
  );
}

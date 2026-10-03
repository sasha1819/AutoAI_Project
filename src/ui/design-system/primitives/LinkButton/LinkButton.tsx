import { ExternalLink } from "lucide-react";
import type { MouseEventHandler } from "react";
import { assertAccessibleName, type NonEmpty } from "../../accessibility/accessible-name.ts";
import { Icon } from "../Icon/index.ts";

export type LinkButtonProps<Label extends string = string> = {
  /** The words, shown as a link inside a sentence ("Create one in the Anthropic Console"). */
  readonly children: NonEmpty<Label>;
  readonly onClick: MouseEventHandler<HTMLButtonElement>;
  /**
   * Opens something outside the app (in the user's browser, through a main-process channel): shows the external
   * icon and tells screen readers so.
   */
  readonly external?: boolean;
};

/**
 * Link-looking text that runs an action: the app never navigates, so "links" are buttons that ask main to do
 * something (ADR 0007). Inline in text, link colour, underlined on hover, the violet focus ring (§7 use 3).
 */
export function LinkButton<Label extends string>({
  children,
  onClick,
  external = false,
}: LinkButtonProps<Label>) {
  assertAccessibleName(children, "LinkButton");
  return (
    <button
      type="button"
      // External: the visible words, then where they lead; the visible label starts the name (WCAG 2.5.3).
      {...(external ? { "aria-label": `${children} (opens in your browser)` } : {})}
      onClick={onClick}
      className="inline-flex cursor-pointer items-baseline gap-1 rounded-tag text-text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
    >
      {children}
      {external && (
        <span className="inline-flex self-center">
          <Icon glyph={ExternalLink} decorative size="xs" />
        </span>
      )}
    </button>
  );
}

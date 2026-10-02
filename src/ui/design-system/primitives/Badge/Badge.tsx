import type { ReactNode } from "react";
import type { NonEmpty } from "../../accessibility/accessible-name.ts";
import { ToneBadge } from "../_badge/index.ts";

export type BadgeProps<Label extends string = string> = {
  /** The text. Required and non-empty: a badge is words, not just a coloured shape. */
  readonly label: NonEmpty<Label>;
  /** Decorative; the label carries the meaning. */
  readonly icon?: ReactNode;
  /** Caps, for short tags (an area, "CURRENT"). */
  readonly uppercase?: boolean;
};

/**
 * A small neutral tag: an area name, a count, a kind. It has no tone prop on purpose: a status or severity is shown
 * with StatusPill or SeverityTag, which pick the colour from the domain value (ARCHITECTURE §7).
 */
export function Badge<Label extends string>({ label, icon, uppercase = false }: BadgeProps<Label>) {
  return <ToneBadge label={label} tone="plain" icon={icon} uppercase={uppercase} />;
}

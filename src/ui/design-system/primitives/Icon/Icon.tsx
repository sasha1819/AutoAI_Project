import type { LucideIcon } from "lucide-react";
import { assertAccessibleName, type NonEmpty } from "../../accessibility/accessible-name.ts";

/** A glyph from lucide-react (`import { Check } from "lucide-react"`), passed as the component, not an element. */
export type IconGlyph = LucideIcon;

export type IconSize = "xs" | "sm" | "md" | "lg" | "xl";

/**
 * Either it means something on its own (a status icon with no text beside it: it gets a label), or it is decorative
 * (next to words that already say it: hidden from assistive tech). Never both, never neither.
 */
export type IconProps<Label extends string = string> =
  | {
      readonly glyph: IconGlyph;
      readonly size?: IconSize;
      readonly label: NonEmpty<Label>;
      readonly decorative?: false;
    }
  | {
      readonly glyph: IconGlyph;
      readonly size?: IconSize;
      readonly decorative: true;
      readonly label?: never;
    };

/**
 * Measured: xs 12 (tags) · sm 14 (sm/md buttons, small fields) · md 16 (lg buttons, fields) · lg 20 (the icon rail,
 * mockups 4 and 9) · xl 24 (the empty-state tile, mockup 9).
 */
const ICON_SIZE: Record<IconSize, string> = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
  xl: "size-6",
};

/** An icon in the current text colour: its colour comes from the text around it, never from the icon. */
export function Icon<Label extends string>(props: IconProps<Label>) {
  const { glyph: Glyph, size = "md" } = props;
  const className = `shrink-0 ${ICON_SIZE[size]}`;
  if (props.decorative === true)
    return <Glyph aria-hidden="true" focusable="false" className={className} />;
  assertAccessibleName(props.label, "Icon");
  return <Glyph role="img" aria-label={props.label} focusable="false" className={className} />;
}

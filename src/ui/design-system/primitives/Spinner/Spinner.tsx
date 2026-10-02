import { LoaderCircle } from "lucide-react";
import { useId } from "react";
import { assertAccessibleName, type NonEmpty } from "../../accessibility/accessible-name.ts";

export type SpinnerSize = "sm" | "md" | "lg";

/**
 * Either it says what is loading (a status named by its label), or it is decorative: inside a control that already
 * tells assistive tech it is busy (a loading Button). Never both, never neither. A status inserted already filled
 * is not announced by every screen reader: where hearing "loading" matters, the screen says it in a live region
 * that stays on the page (the Toast/announcer), not only here.
 */
export type SpinnerProps<Label extends string = string> =
  | { readonly label: NonEmpty<Label>; readonly decorative?: false; readonly size?: SpinnerSize }
  | { readonly decorative: true; readonly label?: never; readonly size?: SpinnerSize };

// sm matches the icons in sm/md Buttons and IconButtons (14px), md the lg ones (16px), lg a loading area (24px).
const SIZE: Record<SpinnerSize, string> = { sm: "size-3.5", md: "size-4", lg: "size-6" };

/** A spinning circle in the current text colour. With reduced motion it stays still; the label still says it. */
export function Spinner<Label extends string>(props: SpinnerProps<Label>) {
  const labelId = useId();
  const icon = (
    <LoaderCircle
      aria-hidden="true"
      className={`shrink-0 animate-spin motion-reduce:animate-none ${SIZE[props.size ?? "md"]}`}
    />
  );
  if (props.decorative === true) return icon;
  assertAccessibleName(props.label, "Spinner");
  return (
    // One source for the name and the text: the status is named by its own (visually hidden) label.
    <span role="status" aria-labelledby={labelId} className="inline-flex items-center">
      {icon}
      <span id={labelId} className="sr-only">
        {props.label}
      </span>
    </span>
  );
}

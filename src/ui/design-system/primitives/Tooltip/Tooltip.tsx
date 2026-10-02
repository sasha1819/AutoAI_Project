import * as RadixTooltip from "@radix-ui/react-tooltip";
import { cloneElement, type ReactElement, useId } from "react";
import { assertAccessibleName, type NonEmpty } from "../../accessibility/accessible-name.ts";

export type TooltipSide = "top" | "right" | "bottom" | "left";

export type TooltipProps<Text extends string = string> = {
  /** Short plain text. A tooltip holds no links or buttons: it disappears when the pointer or focus leaves. */
  readonly text: NonEmpty<Text>;
  /**
   * label: the text repeats the trigger's own accessible name (an IconButton's label) for sighted users, so it is
   * not linked and not read twice. description: extra information, read after the name (aria-describedby).
   */
  readonly purpose: "label" | "description";
  readonly side?: TooltipSide;
  /**
   * One focusable element that passes on the props and ref it gets (Button, IconButton). A disabled button gets no
   * pointer or focus events, so it shows no tooltip: say why it is disabled somewhere visible instead.
   */
  readonly children: ReactElement<{ readonly "aria-describedby"?: string }>;
  /** Story-only (screens let hover and focus open it): opens it on first render. */
  readonly defaultOpen?: boolean;
};

const CONTENT =
  "z-50 max-w-64 rounded-control border border-border-strong bg-raised px-2 py-1 text-xs font-medium " +
  "text-text-primary shadow-overlay";

/**
 * Shows on hover (after a short delay) and at once on keyboard focus; Escape, blur, a click or leaving closes it,
 * and the pointer may move onto it without closing it (WCAG 1.4.13). Radix gives the behaviour; this gives the look.
 */
export function Tooltip<Text extends string>({
  text,
  purpose,
  side = "top",
  children,
  defaultOpen,
}: TooltipProps<Text>) {
  assertAccessibleName(text, "Tooltip");
  const label = purpose === "label";
  const contentId = useId();
  // The child's own props win when Radix merges them, so a description it already has would replace the link to
  // the tooltip: join the two instead.
  const own = children.props["aria-describedby"];
  const trigger = label
    ? children
    : cloneElement(children, {
        "aria-describedby": own === undefined ? contentId : `${own} ${contentId}`,
      });
  return (
    // A provider per tooltip: no app-wide setup to forget. The cost: no shortened delay when moving between tooltips.
    <RadixTooltip.Provider>
      <RadixTooltip.Root {...(defaultOpen === undefined ? {} : { defaultOpen })}>
        {/* As a label, the trigger is already named by the same words: no description link. */}
        <RadixTooltip.Trigger asChild {...(label ? { "aria-describedby": undefined } : {})}>
          {trigger}
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={4}
            collisionPadding={8}
            id={contentId}
            className={CONTENT}
            {...(label ? { "aria-hidden": true } : {})}
          >
            {text}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}

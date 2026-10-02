import type { ReactNode } from "react";

/**
 * surface: a card on the page (mockup 11, finding card: surface fill, subtle edge, 20px padding).
 * sunken: a box inside a card (mockup 7, "Quick facts": sunken fill, strong edge, 14 x 12 padding).
 */
export type CardTone = "surface" | "sunken";

/**
 * md: a content card (the padding above). sm: a row-like card, one line of content and maybe a small button
 * (mockup 9 suggestions: surface, 16 x 10, ~48 tall; mockup 6 "Not covered yet": sunken, 14 x 10, ~50 tall).
 */
export type CardSize = "md" | "sm";

/** div by default; article for a self-contained item (a finding); li inside a list of cards. */
export type CardElement = "div" | "article" | "li";

type CardBase = {
  readonly children: ReactNode;
  readonly tone?: CardTone;
  readonly size?: CardSize;
};

/** Only an article can be named (a div or li has no role a name belongs to). */
export type CardProps = CardBase &
  (
    | { readonly as?: "div" | "li"; readonly labelledBy?: never }
    | {
        readonly as: "article";
        /** The id of the card's own heading: it names the article for screen readers. */
        readonly labelledBy?: string;
      }
  );

const ELEMENTS: ReadonlySet<string> = new Set<CardElement>(["div", "article", "li"]);

const TONE: Record<CardTone, string> = {
  surface: "border-border-subtle bg-surface",
  sunken: "border-border-strong bg-sunken",
};

const PADDING: Record<CardTone, Record<CardSize, string>> = {
  surface: { md: "p-5", sm: "px-4 py-2.5" },
  sunken: { md: "px-3.5 py-3", sm: "px-3.5 py-2.5" },
};

/** A container with an edge. It adds no role or behaviour: what is inside decides (a heading, a list, actions). */
export function Card({
  children,
  tone = "surface",
  size = "md",
  as: Element = "div",
  labelledBy,
}: CardProps) {
  // The type allows only these; a value from untyped data must not turn a card into a control.
  if (!ELEMENTS.has(Element)) throw new Error(`Card cannot be a <${Element}>`);
  return (
    <Element
      className={`min-w-0 rounded-card border ${TONE[tone]} ${PADDING[tone][size]}`}
      {...(labelledBy === undefined || Element !== "article"
        ? {}
        : { "aria-labelledby": labelledBy })}
    >
      {children}
    </Element>
  );
}

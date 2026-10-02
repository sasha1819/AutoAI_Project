import type { ReactElement } from "react";
import { assertAccessibleName, type NonEmpty } from "../../accessibility/accessible-name.ts";
import { Icon, type IconGlyph } from "../Icon/index.ts";

type HeadingLevel = 2 | 3 | 4;

/**
 * page: a whole area with nothing in it yet (mockup 9: 64px icon tile, 18px title, a line of help, then what to do).
 * compact: one muted line inside a panel or list (mockup 9 sidebar: "Nothing here yet — ...").
 */
export type EmptyStateProps<Title extends string = string> =
  | {
      readonly size?: "page";
      /** Says what is missing ("No test cases yet"), as a heading at headingLevel (default 2). */
      readonly title: NonEmpty<Title>;
      /** Says why, or how to start. */
      readonly description?: string;
      /** Decorative: the title says it. */
      readonly icon?: IconGlyph;
      readonly headingLevel?: HeadingLevel;
      /** What to do next: buttons, a field, suggestions. Laid out under the text, centred. */
      readonly actions?: ReactElement;
    }
  | {
      readonly size: "compact";
      readonly title: NonEmpty<Title>;
      readonly description?: never;
      readonly icon?: never;
      readonly headingLevel?: never;
      readonly actions?: never;
    };

const HEADING = { 2: "h2", 3: "h3", 4: "h4" } as const;

/** Shown where a list or area has nothing yet. Static text, not announced: it is what the area contains. */
export function EmptyState<Title extends string>(props: EmptyStateProps<Title>) {
  assertAccessibleName(props.title, "EmptyState");
  if (props.size === "compact") {
    return <p className="mx-auto max-w-64 text-center text-sm text-text-muted">{props.title}</p>;
  }
  const { title, description, icon, headingLevel = 2, actions } = props;
  // The type allows 2-4; a number from untyped data would otherwise render an unknown element.
  const level: number = headingLevel;
  if (level !== 2 && level !== 3 && level !== 4) {
    throw new Error(`EmptyState headingLevel must be 2, 3 or 4, got ${String(level)}`);
  }
  const Heading = HEADING[headingLevel];
  const help = description !== undefined && description.trim() !== "" ? description : undefined;
  return (
    <div className="flex flex-col items-center px-4 text-center">
      {icon !== undefined && (
        <div className="mb-5 flex size-16 items-center justify-center rounded-tile border border-border-default bg-sunken text-text-muted">
          <Icon glyph={icon} decorative size="xl" />
        </div>
      )}
      <Heading className="text-heading font-bold text-text-primary">{title}</Heading>
      {help !== undefined && <p className="mt-2.5 max-w-120 text-md text-text-secondary">{help}</p>}
      {actions !== undefined && (
        <div className="mt-6 flex w-full max-w-128 flex-col items-stretch gap-3">{actions}</div>
      )}
    </div>
  );
}

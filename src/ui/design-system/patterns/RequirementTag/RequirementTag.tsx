import type { Requirement } from "../../../../core/domain/requirement.ts";
import { assertAccessibleName } from "../../accessibility/accessible-name.ts";

export type RequirementTagProps = {
  /** The requirement's tag as parsed from the PRD ("Cart 2.4", or a heading's title). */
  readonly tag: Requirement["tag"];
};

/**
 * Which PRD requirement something comes from (mockup 11: "PRD · Cart 2.4", plain text in the card header). Neutral:
 * mockups 4 and 12 draw it lavender, but violet is closed to primary and AI uses (ARCHITECTURE §7) — recorded.
 */
export function RequirementTag({ tag }: RequirementTagProps) {
  assertAccessibleName(tag, "RequirementTag");
  return (
    <span className="inline-flex min-w-0 items-baseline gap-1.5 text-text-secondary">
      {/* The spaces keep the name "PRD Cart 2.4" when the tag sits inside a link or row; flex does not draw them. */}
      <span className="text-xs font-semibold tracking-wide uppercase">PRD</span>{" "}
      <span aria-hidden="true">·</span> <span className="truncate font-mono text-sm">{tag}</span>
    </span>
  );
}

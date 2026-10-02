import { Sparkles } from "lucide-react";
import { assertAccessibleName, type NonEmpty } from "../../accessibility/accessible-name.ts";
import { Icon } from "../../primitives/Icon/index.ts";

export type AiChipProps<Label extends string = string> = {
  /** What Claude did, in words ("3 mismatches found by Claude"): the words, not the violet, say it is AI. */
  readonly label: NonEmpty<Label>;
};

/**
 * Marks content as Claude's (ARCHITECTURE §7, violet use 2): the sparkle and words on the AI tint. Not a control —
 * an action that asks Claude is an AiActionButton. Measured, mockup 11: 30 tall, control radius, ai-surface fill,
 * ai-border edge, ai-text 13px medium, a 12px sparkle.
 */
export function AiChip<Label extends string>({ label }: AiChipProps<Label>) {
  assertAccessibleName(label, "AiChip");
  return (
    <span className="inline-flex h-7.5 max-w-full min-w-0 items-center gap-2 rounded-control border border-ai-border bg-ai-surface px-3 text-md font-medium text-ai-text">
      <Icon glyph={Sparkles} decorative size="xs" />
      <span className="truncate">{label}</span>
    </span>
  );
}

export type AiMarkProps<Label extends string = string> =
  /** Next to a heading that already says it ("Claude's diagnosis"): hidden from assistive tech. */
  | { readonly decorative: true; readonly label?: never }
  /** On its own: says what it marks. */
  | { readonly label: NonEmpty<Label>; readonly decorative?: false };

/** The AI tile before an AI panel's title (mockup 7 "Claude's diagnosis", 14 "Likely cause"): 28px, 16px sparkle. */
export function AiMark<Label extends string>(props: AiMarkProps<Label>) {
  const tile =
    "inline-flex size-7 shrink-0 items-center justify-center rounded-control bg-ai-tile text-ai-text";
  if (props.decorative === true) {
    return (
      <span aria-hidden="true" className={tile}>
        <Icon glyph={Sparkles} decorative size="md" />
      </span>
    );
  }
  assertAccessibleName(props.label, "AiMark");
  return (
    <span className={tile}>
      <Icon glyph={Sparkles} label={props.label} size="md" />
    </span>
  );
}

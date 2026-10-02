import { assertAccessibleName, type NonEmpty } from "../../accessibility/accessible-name.ts";
import { Icon, type IconGlyph } from "../Icon/index.ts";

// The badge look, with the status tones. Internal on purpose (ARCHITECTURE §7): status colours are chosen only by
// StatusPill and SeverityTag, which map a domain value to a tone; screens get the neutral Badge and cannot pick a
// colour. tokens:check refuses status colour classes outside the files allowed to map them.

export type BadgeTone = "plain" | "neutral" | "passed" | "failed" | "warning" | "running";

// Measured in the mockups: 19-20px tall, 11px semibold text, the tag radius, ~8px side padding (7 "FAILED",
// 11 "High"/"CART", 13 "RISKY"). Each tone's text meets 4.5:1 on its fill (theme.test.ts).
const LOOK =
  "inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-tag px-2 text-xs font-semibold";
// plain is the public Badge (area tags: CART has a 1px edge in mockup 11); the status and severity tones have none.
const TONE: Record<BadgeTone, string> = {
  plain: "border border-border-default bg-raised text-text-secondary",
  neutral: "bg-status-neutral-surface text-text-secondary",
  passed: "bg-status-passed-surface text-status-passed",
  failed: "bg-status-failed-surface text-status-failed-text",
  warning: "bg-status-warning-surface text-status-warning",
  running: "bg-status-running-surface text-status-running",
};

export type ToneBadgeProps<Label extends string = string> = {
  /** The text: a badge says what it means in words, never by colour alone. */
  readonly label: NonEmpty<Label>;
  readonly tone: BadgeTone;
  /** Decorative; the label carries the meaning. */
  readonly icon?: IconGlyph;
  /** Caps, for status words ("FAILED", "FLAKY") and area tags; title case for severities ("High"). */
  readonly uppercase?: boolean;
};

/** Never wraps: the label is short (a status, an area); the container gives it room. A badge in one of the tones. For StatusPill and SeverityTag; screens use Badge. */
export function ToneBadge<Label extends string>({
  label,
  tone,
  icon,
  uppercase = false,
}: ToneBadgeProps<Label>) {
  assertAccessibleName(label, "Badge");
  return (
    <span className={`${LOOK} ${TONE[tone]} ${uppercase ? "uppercase tracking-wide" : ""}`}>
      {icon !== undefined && (
        <span aria-hidden="true" className="inline-flex">
          <Icon glyph={icon} decorative size="xs" />
        </span>
      )}
      {label}
    </span>
  );
}

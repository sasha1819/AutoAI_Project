import { Icon, type IconGlyph, type IconSize } from "../Icon/index.ts";
import type { BadgeTone } from "./tone-badge.tsx";

// The status tones as a bare glyph or a dot (step rows, run log lines, list rows), for StatusPill's StatusIcon and
// StatusDot only — the status colours stay in this folder (tokens:check). Decorative: the row says the status in
// words. Each colour reaches 3:1 as a graphic on every surface (theme.test.ts).
type StatusTone = Exclude<BadgeTone, "plain">;

const GLYPH: Record<StatusTone, string> = {
  neutral: "text-status-neutral",
  passed: "text-status-passed",
  failed: "text-status-failed",
  warning: "text-status-warning",
  running: "text-status-running",
};
const DOT: Record<StatusTone, string> = {
  neutral: "bg-status-neutral",
  passed: "bg-status-passed",
  failed: "bg-status-failed",
  warning: "bg-status-warning",
  running: "bg-status-running",
};

export function ToneGlyph({
  tone,
  icon,
  size = "sm",
  spins = false,
}: {
  readonly tone: StatusTone;
  readonly icon: IconGlyph;
  readonly size?: IconSize;
  readonly spins?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 ${GLYPH[tone]} ${spins ? "animate-spin motion-reduce:animate-none" : ""}`}
    >
      <Icon glyph={icon} decorative size={size} />
    </span>
  );
}

/** 8px, as the test list's status dots (mockup 4). */
export function ToneDot({ tone }: { readonly tone: StatusTone }) {
  return (
    <span aria-hidden="true" className={`inline-block size-2 shrink-0 rounded-full ${DOT[tone]}`} />
  );
}

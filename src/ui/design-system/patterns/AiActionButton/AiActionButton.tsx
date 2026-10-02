import { Sparkles } from "lucide-react";
import type { MouseEventHandler } from "react";
import { assertAccessibleName, type NonEmpty } from "../../accessibility/accessible-name.ts";
import { Button } from "../../primitives/Button/index.ts";

export type AiActionButtonSize = "sm" | "md" | "lg";

export type AiActionButtonProps<Label extends string = string> = {
  /** What Claude will do, as a verb ("Create test to confirm", "Explain this failure"). */
  readonly label: NonEmpty<Label>;
  readonly onClick: MouseEventHandler<HTMLButtonElement>;
  /** Claude is working on it: the sparkle becomes a spinner; the button stays focusable and ignores presses. */
  readonly loading?: boolean;
  readonly disabled?: boolean;
  /** Measured: md 30 (mockup 11 card actions); sm and lg match Button's. */
  readonly size?: AiActionButtonSize;
  /** Fills its column, as the fix action in a side panel (mockups 7 and 14). */
  readonly fullWidth?: boolean;
};

/**
 * A control that starts an AI action (ARCHITECTURE §7, violet use 2): the primary look with the sparkle, so every
 * action that sends something to the user's AI provider looks the same. A closed set of props.
 */
export function AiActionButton<Label extends string>({
  label,
  onClick,
  loading = false,
  disabled = false,
  size = "md",
  fullWidth = false,
}: AiActionButtonProps<Label>) {
  assertAccessibleName(label, "AiActionButton");
  return (
    <Button
      variant="primary"
      size={size}
      icon={Sparkles}
      loading={loading}
      disabled={disabled}
      fullWidth={fullWidth}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

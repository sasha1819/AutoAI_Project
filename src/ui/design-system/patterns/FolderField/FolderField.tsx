import { Folder } from "lucide-react";
import type { Ref } from "react";
import { Button } from "../../primitives/Button/index.ts";
import { Icon } from "../../primitives/Icon/index.ts";
import { FIELD_LOOK, FieldFrame } from "../../primitives/_field/index.ts";

export type FolderFieldProps = {
  /** The visible label ("Project folder"); it also names the button for screen readers. */
  readonly label: string;
  /** The chosen folder, or null before one is chosen. */
  readonly path: string | null;
  /** Shown while no folder is chosen. */
  readonly placeholder: string;
  /** The button's words ("Choose folder"); the field's label is added to its name. */
  readonly chooseLabel: string;
  readonly onChoose: () => void;
  /** The folder dialog is open, or what was chosen is being read. */
  readonly busy?: boolean;
  readonly hint?: string;
  /** Why the chosen folder cannot be used, in words: the box gets the invalid edge, the button reads it first. */
  readonly error?: string;
  readonly buttonRef?: Ref<HTMLButtonElement>;
};

/**
 * A folder chosen with the system dialog (mockup 3, the repository row): the path in a field-like box, and a button
 * that opens the dialog. The path is not typed: folders come only from the dialog (ADR 0007), so the box is text,
 * not an input. It shares the form fields' frame (label, hint, error wiring) and look, so it sits beside an Input
 * without drifting. A long path wraps rather than being cut, so everyone can read all of it.
 */
export function FolderField({
  label,
  path,
  placeholder,
  chooseLabel,
  onChoose,
  busy = false,
  hint,
  error,
  buttonRef,
}: FolderFieldProps) {
  return (
    <FieldFrame label={label} hideLabel={false} hint={hint} error={error} component="FolderField">
      {(wiring) => {
        const pathId = `${wiring.id}-path`;
        // The error first, then the path, then the hint (as a text field reads its error before its hint).
        const described = wiring.describedBy?.split(" ") ?? [];
        const errorIds = described.filter((id) => id.endsWith("-error"));
        const otherIds = described.filter((id) => !id.endsWith("-error"));
        return (
          <div className="flex gap-2.5">
            <div
              aria-invalid={wiring.invalid || undefined}
              className={`${FIELD_LOOK} flex min-h-11 min-w-0 flex-1 items-center gap-2 px-4 py-2.5 text-md`}
            >
              <span className="inline-flex text-text-muted">
                <Icon glyph={Folder} decorative />
              </span>
              <span
                id={pathId}
                className={`break-all ${path === null ? "text-text-muted" : "text-text-primary"}`}
              >
                {path ?? placeholder}
              </span>
            </div>
            <Button
              ref={buttonRef}
              id={wiring.id}
              variant="secondary"
              size="xl"
              loading={busy}
              onClick={onChoose}
              aria-label={`${chooseLabel}: ${label}`}
              aria-describedby={[...errorIds, pathId, ...otherIds].join(" ")}
            >
              {chooseLabel}
            </Button>
          </div>
        );
      }}
    </FieldFrame>
  );
}

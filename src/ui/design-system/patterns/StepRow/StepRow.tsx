import { assertAccessibleName, type NonEmpty } from "../../accessibility/accessible-name.ts";
import { formatDuration } from "../_format/index.ts";
import { type PillStatus, StatusIcon, statusWord } from "../StatusPill/index.ts";

export type StepRowProps<Name extends string = string> = {
  /** The step in plain words ("Open the first result"). */
  readonly name: NonEmpty<Name>;
  readonly status: PillStatus;
  /** How long it took; left out while it runs (shows "…") or if it never ran ("–"). */
  readonly durationMs?: number;
};

/**
 * One step of a test (mockup 7's step list: a 14px status icon, the step, its duration in mono; 34px rows). The
 * content of a row, not a control: put it in a SidebarList to make steps selectable. The status is said in words
 * after the name, so a screen reader hears "Open the app, passed, 1.2s".
 */
export function StepRow<Name extends string>({ name, status, durationMs }: StepRowProps<Name>) {
  assertAccessibleName(name, "StepRow");
  const ran = status !== "not_run";
  return (
    <span className="flex min-h-8.5 w-full min-w-0 items-center gap-2.5 pl-2">
      <StatusIcon status={status} />
      <span
        className={`min-w-0 flex-1 truncate text-md ${ran ? "text-text-primary" : "text-text-muted"}`}
      >
        {name}
        <span className="sr-only">, {statusWord(status).toLowerCase()}</span>
      </span>
      <span className="shrink-0 font-mono text-xs text-text-muted">
        {durationMs === undefined ? (
          <span aria-hidden="true">{status === "running" ? "…" : "–"}</span>
        ) : (
          <>
            <span className="sr-only">, </span>
            {formatDuration(durationMs)}
          </>
        )}
      </span>
    </span>
  );
}

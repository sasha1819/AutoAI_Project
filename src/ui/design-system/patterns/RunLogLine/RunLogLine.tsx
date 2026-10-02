import { Children, isValidElement, type ReactElement } from "react";
import { assertAccessibleName, type NonEmpty } from "../../accessibility/accessible-name.ts";
import { formatDuration, formatElapsed } from "../_format/index.ts";
import { StatusIcon, statusWord } from "../StatusPill/index.ts";

type Line<Text extends string> = {
  /** What happened, in plain words ("Opened the app at shop.example.com"). */
  readonly text: NonEmpty<Text>;
};

/** A line's state decides what it can show: a line not reached has no time; only a running line is current. */
export type RunLogLineProps<Text extends string = string> = Line<Text> &
  (
    | {
        readonly status: "not_run";
        readonly atMs?: never;
        readonly durationMs?: never;
        readonly current?: never;
      }
    | {
        readonly status: "running";
        /** Time since the run started. */
        readonly atMs: number;
        readonly durationMs?: never;
        /** The line the run is on now: highlighted. */
        readonly current?: boolean;
      }
    | {
        readonly status: "passed" | "failed" | "flaky";
        readonly atMs: number;
        /** How long it took. */
        readonly durationMs?: number;
        readonly current?: never;
      }
  );

/**
 * One line of a run's live log (mockup 4: elapsed time in mono, a status icon, the step, its duration; 26px lines).
 * Goes inside a RunLog. Read as "00:06.5, Adding product to cart, running".
 */
export function RunLogLine<Text extends string>({
  atMs,
  status,
  text,
  durationMs,
  current = false,
}: RunLogLineProps<Text>) {
  assertAccessibleName(text, "RunLogLine");
  const reached = status !== "not_run";
  return (
    <li
      aria-current={current ? "step" : undefined}
      className={`flex min-h-6.5 items-center gap-3 rounded-control px-2 ${current ? "bg-selected" : ""}`}
    >
      <span className="w-14 shrink-0 font-mono text-sm text-text-muted">
        {atMs === undefined ? <span aria-hidden="true">–</span> : formatElapsed(atMs)}
      </span>
      <StatusIcon status={status} />
      <span
        className={`min-w-0 flex-1 truncate text-md ${reached ? "text-text-primary" : "text-text-muted"}`}
      >
        {reached && <span className="sr-only">, </span>}
        {text}
        <span className="sr-only">, {statusWord(status).toLowerCase()}</span>
      </span>
      <span className="shrink-0 font-mono text-sm text-text-muted">
        {durationMs === undefined ? (
          <span aria-hidden="true">{status === "running" ? "…" : "–"}</span>
        ) : (
          <>
            <span className="sr-only">, </span>
            {formatDuration(durationMs)}
          </>
        )}
      </span>
    </li>
  );
}

export type RunLogProps<Label extends string = string> = {
  /** Names the log ("Run log"). */
  readonly label: NonEmpty<Label>;
  /** The lines in time order, upcoming ones last. Give each a stable key, so a changing line is not re-announced. */
  readonly children: ReactElement<RunLogLineProps> | readonly ReactElement<RunLogLineProps>[];
};

/**
 * The live log of a run. The lines reached so far sit in a log region (role log, read politely, additions only), so
 * a step is announced once, when the run reaches it; the steps still to come follow in a plain list that looks the
 * same. Without that split, upcoming lines listed up front (mockup 4) would only change, never be added, and
 * nothing would be announced. A log needs at least one line.
 */
export function RunLog<Label extends string>({ label, children }: RunLogProps<Label>) {
  assertAccessibleName(label, "RunLog");
  const lines = Children.toArray(children).filter(isValidElement<RunLogLineProps>);
  if (lines.length === 0) throw new Error("RunLog needs at least one line");
  const firstUpcoming = lines.findIndex((line) => line.props.status === "not_run");
  if (
    firstUpcoming !== -1 &&
    lines.slice(firstUpcoming).some((line) => line.props.status !== "not_run")
  ) {
    throw new Error("RunLog: upcoming lines go last, after every line the run has reached");
  }
  const reached = lines.filter((line) => line.props.status !== "not_run");
  const upcoming = lines.filter((line) => line.props.status === "not_run");
  return (
    <div className="flex min-w-0 flex-col">
      <div role="log" aria-label={label} aria-relevant="additions">
        <ol className="flex flex-col">{reached}</ol>
      </div>
      {upcoming.length > 0 && (
        <ol aria-label="Not reached yet" className="flex flex-col">
          {upcoming}
        </ol>
      )}
    </div>
  );
}

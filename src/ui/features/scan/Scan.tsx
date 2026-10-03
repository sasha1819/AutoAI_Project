import { useEffect, useId, useRef } from "react";
import type { ScanReport } from "../../../contracts/scan.ts";
import { PageColumn } from "../../design-system/patterns/PageColumn/index.ts";
import { StepRow } from "../../design-system/patterns/StepRow/index.ts";
import { Button } from "../../design-system/primitives/Button/index.ts";
import { Card } from "../../design-system/primitives/Card/index.ts";
import { ArrowRight } from "../../design-system/primitives/Icon/index.ts";
import { ProgressBar } from "../../design-system/primitives/ProgressBar/index.ts";
import { STOPPED_MESSAGE, type ScanCode, WARNING_MESSAGE } from "./messages.ts";
import { type ScanOutcome, scanSteps, type Timed } from "./scan-steps.ts";
import { plural } from "../../design-system/wording/index.ts";
import { type ScanTarget, useScan } from "./useScan.ts";

export type ScanViewProps = {
  readonly repoRoot: string;
  readonly events: readonly Timed[];
  readonly outcome: ScanOutcome;
  readonly report: ScanReport | null;
  readonly error?: string | undefined;
  readonly errorCode?: ScanCode | null;
  readonly onSeeResults: (report: ScanReport) => void;
  readonly onBack: () => void;
  readonly onConnectAi: () => void;
};

const TITLE: Record<ScanOutcome, string> = {
  running: "Scanning your project",
  done: "Scan complete",
  stopped: "The scan stopped early",
  failed: "The scan didn't run",
};

// Codes whose way out is connecting Claude again, not choosing other folders.
const KEY_CODES: ReadonlySet<ScanCode> = new Set<ScanCode>([
  "NO_KEY",
  "SECRET_STORE_UNAVAILABLE",
  "SECRET_STORE_FAILED",
]);

/**
 * Scan progress (PRD Flow 1 step 4; no mockup, composed from the design system in mockup 3's column): the three
 * stages the scan service streams, a bar while Claude compares areas, then how it ended. Pass/fail of the scan is
 * the service's reply; this screen only says it.
 */
export function ScanView(props: ScanViewProps) {
  const { repoRoot, events, outcome, report, error, errorCode } = props;
  const { steps, compare, now, extracting } = scanSteps(events, outcome);
  const running = outcome === "running";
  const summaryId = useId();
  // The way out of a key problem: before the scan (a key code) or during it (Anthropic rejected the key).
  const needsKey =
    (errorCode !== null && errorCode !== undefined && KEY_CODES.has(errorCode)) ||
    report?.stoppedBy?.code === "AI_AUTH_FAILED";
  const onlyBack = report === null && !needsKey;
  // When it ends, the next action takes focus (the progress had none) and reads the outcome with it, since a polite
  // announcement can be cut off by the focus move.
  const next = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!running) next.current?.focus();
  }, [running]);

  return (
    <PageColumn>
      <h1 className="text-xl font-bold text-text-primary">{TITLE[outcome]}</h1>
      <p className="mt-2 text-md break-all text-text-secondary">{repoRoot}</p>

      <div className="mt-8">
        <Card>
          {compare !== null && running && (
            // Above the rows, as mockup 4's run header ("4 of 9 done" over the log).
            <div className="mb-4">
              <ProgressBar
                label="Comparison progress"
                value={compare.done}
                max={compare.total}
                valueText={`${String(compare.done)} of ${plural(compare.total, "area")} compared`}
              />
            </div>
          )}
          <ul aria-label="Scan steps" className="flex flex-col">
            {steps.map((step) => (
              <li key={step.id}>
                <StepRow
                  name={step.name}
                  status={step.status}
                  {...(step.durationMs === undefined ? {} : { durationMs: step.durationMs })}
                />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Always on the page: the stage while it runs (one line per stage), then how it ended, are announced. */}
      <div
        id={summaryId}
        role="status"
        className="mt-6 flex flex-col gap-2 text-sm text-text-secondary"
      >
        {running ? (
          <>
            <p className="sr-only">{now}</p>
            <p>
              {extracting
                ? "Claude reads your PRDs written as prose to find requirements, one file at a time."
                : "Claude compares your PRDs with the relevant code, one area at a time."}{" "}
              This can take a few minutes; keep AutoAI open.
            </p>
          </>
        ) : (
          <p className="sr-only">{TITLE[outcome]}.</p>
        )}
        {error !== undefined && <p>{error}</p>}
        {report !== null && report.stoppedBy !== null && (
          <p>
            {STOPPED_MESSAGE[report.stoppedBy.code]} The findings from before it stopped are kept.
          </p>
        )}
        {report !== null && <ReportLines report={report} />}
      </div>

      {!running && (
        <div className="mt-10 flex flex-wrap gap-3">
          <Button
            // When nothing else can be done, Back is the next action.
            {...(onlyBack ? { ref: next, "aria-describedby": summaryId } : {})}
            variant={onlyBack ? "primary" : "secondary"}
            size="xl"
            onClick={props.onBack}
          >
            Back to your project
          </Button>
          {report !== null && (
            <Button
              {...(needsKey ? {} : { ref: next, "aria-describedby": summaryId })}
              variant={needsKey ? "secondary" : "primary"}
              size="xl"
              trailingIcon={ArrowRight}
              onClick={() => {
                props.onSeeResults(report);
              }}
            >
              See results
            </Button>
          )}
          {needsKey && (
            <Button ref={next} aria-describedby={summaryId} size="xl" onClick={props.onConnectAi}>
              Connect Claude
            </Button>
          )}
        </div>
      )}
    </PageColumn>
  );
}

/** What the finished scan found and what it cost, in plain counts (the Wow summary explains them). */
function ReportLines({ report }: { readonly report: ScanReport }) {
  const kinds = [...new Set(report.warnings.map((w) => w.code))];
  const { aiCalls, inputTokens, outputTokens } = report.usage;
  return (
    <>
      <p>
        {plural(report.requirements.length, "requirement")} read,{" "}
        {plural(report.findings.length, "finding")}
        {report.notScanned.length > 0 ? `, ${String(report.notScanned.length)} not scanned` : ""}.
      </p>
      {report.needsReview.length > 0 && (
        <p>
          {report.needsReview.length === 1
            ? "1 requirement Claude found needs your review, so it was not compared. It is listed in the results."
            : `${String(report.needsReview.length)} requirements Claude found need your review, so they were not compared. They are listed in the results.`}
        </p>
      )}
      {report.extraction.dropped > 0 && (
        <p>
          {report.extraction.dropped === 1
            ? "1 requirement Claude found was left out: its quote was not in your PRD."
            : `${String(report.extraction.dropped)} requirements Claude found were left out: their quote was not in your PRD.`}
        </p>
      )}
      {kinds.map((code) => (
        <p key={code}>{WARNING_MESSAGE[code]}</p>
      ))}
      <p className="text-text-muted">
        {aiCalls === 0
          ? "No AI calls were made."
          : `${plural(aiCalls, "Claude call")}: ${inputTokens.toLocaleString("en-US")} tokens sent, ${outputTokens.toLocaleString("en-US")} received (billed by Anthropic).`}
      </p>
    </>
  );
}

/** The scan screen: its hook and its view. It starts the scan when it opens. */
export function Scan({
  target,
  onSeeResults,
  onBack,
  onConnectAi,
}: {
  readonly target: ScanTarget;
  readonly onSeeResults: (report: ScanReport) => void;
  readonly onBack: () => void;
  readonly onConnectAi: () => void;
}) {
  const scan = useScan(target);
  return (
    <ScanView
      repoRoot={target.repoRoot}
      events={scan.events}
      outcome={scan.outcome}
      report={scan.report}
      error={scan.error}
      errorCode={scan.errorCode}
      onSeeResults={onSeeResults}
      onBack={onBack}
      onConnectAi={onConnectAi}
    />
  );
}

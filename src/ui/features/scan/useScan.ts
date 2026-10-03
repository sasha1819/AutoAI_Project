import { useEffect, useRef, useState } from "react";
import type { ScanReport } from "../../../contracts/scan.ts";
import { BROKEN_MESSAGE, bridge } from "../../app/bridge.ts";
import { SCAN_MESSAGE, type ScanCode } from "./messages.ts";
import type { ScanOutcome, Timed } from "./scan-steps.ts";

export type ScanTarget = { readonly repoRoot: string; readonly prdFolder: string | null };

export type ScanState = {
  readonly events: readonly Timed[];
  readonly outcome: ScanOutcome;
  /** The finished (or stopped) scan's report. */
  readonly report: ScanReport | null;
  /** Why the scan did not run, in words. */
  readonly error: string | undefined;
  /** The code behind the error, so the screen can offer the right way out (e.g. Connect Claude). */
  readonly errorCode: ScanCode | null;
};

/**
 * The scan screen's one hook: starts one scan of the project when the screen opens and follows its progress. The
 * scan runs in main; this only listens. One scan per visit: React's development double-start does not start two.
 */
export function useScan(target: ScanTarget): ScanState {
  const [events, setEvents] = useState<readonly Timed[]>([]);
  const [outcome, setOutcome] = useState<ScanOutcome>("running");
  const [report, setReport] = useState<ScanReport | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [errorCode, setErrorCode] = useState<ScanCode | null>(null);
  const started = useRef(false);

  // Listening is its own effect, so it can stop and start again freely; the scan itself starts only once.
  useEffect(() => {
    try {
      return bridge().on("scan:progress", ({ progress }) => {
        setEvents((before) => [...before, { at: Date.now(), progress }]);
      });
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const run = async () => {
      try {
        const reply = await bridge().invoke("scan:run", target);
        if (reply.ok) {
          setReport(reply.value);
          setOutcome(reply.value.stoppedBy === null ? "done" : "stopped");
        } else {
          setError(SCAN_MESSAGE[reply.error.code]);
          setErrorCode(reply.error.code);
          setOutcome("failed");
        }
      } catch (e) {
        console.error(e);
        setError(BROKEN_MESSAGE);
        setOutcome("failed");
      }
    };
    void run();
    // One scan per visit: the app mounts this screen afresh for each Scan press, so the target never changes while
    // it is open (deps left empty on purpose; the ref keeps React's development double-start to one scan).
  }, []);

  return { events, outcome, report, error, errorCode };
}

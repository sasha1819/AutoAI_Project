// How patterns write times, so a step row and a run log line always agree (mockups 4 and 7). Display only.

/** A step's duration: "0.8s", "10.0s", "1m 05s". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0)
    throw new Error(`formatDuration: not a duration: ${String(ms)}`);
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${String(minutes)}m ${String(seconds).padStart(2, "0")}s`;
}

/** Time since the run started, as the run log's first column: "00:06.5", "12:04.0". */
export function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0)
    throw new Error(`formatElapsed: not an elapsed time: ${String(ms)}`);
  const tenths = Math.floor(ms / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(tenths % 10)}`;
}

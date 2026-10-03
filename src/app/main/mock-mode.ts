/**
 * Whether the app runs with the mock AI (development without a real key): only when AUTOAI_MOCK_AI=1 AND the app
 * is not packaged. A packaged app ignores the variable entirely.
 */
export function isMockAiMode(options: {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly packaged: boolean;
}): boolean {
  return !options.packaged && options.env["AUTOAI_MOCK_AI"] === "1";
}

/**
 * Type-checks one generated Playwright spec in isolation (ADR 0004). Uses AutoAI's own TypeScript and Playwright
 * types, never the target repo's. Errors are "line:column message"; an empty list means the spec compiles.
 */
export type SpecChecker = {
  readonly check: (
    fileName: string,
    text: string,
  ) => Promise<{ readonly errors: readonly string[] }>;
};

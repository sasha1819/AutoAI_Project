import { isHiddenPath } from "./hidden-path.ts";

const SOURCE_EXTENSION = /\.(tsx?|jsx?|mjs|cjs|vue|svelte|html)$/i;
const NOT_SOURCE_SUFFIX = /\.(d\.ts|min\.js|(test|spec)\.[cm]?[jt]sx?)$/i;
// Test, lint and format tool configs describe tooling, not app behaviour, like tests/ below. Build and framework
// configs (vite, next, webpack, ...) are kept: they can hold routes, redirects, proxies or the base path.
const TOOL_CONFIG =
  /(^|\/)((playwright|vitest|jest|cypress|eslint|prettier|stylelint|commitlint)\.config|karma\.conf)\.[cm]?[jt]s$/i;
// Tests are skipped too: otherwise AutoAI's own generated specs (tests/autoai) would feed back into matching.
const SKIPPED_FOLDERS = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  "vendor",
  "test",
  "tests",
  "__tests__",
  "e2e",
]);

/** True when a repo-relative path is application code worth reading to judge a requirement. */
export function isSourceFile(path: string): boolean {
  if (
    !SOURCE_EXTENSION.test(path) ||
    NOT_SOURCE_SUFFIX.test(path) ||
    TOOL_CONFIG.test(path) ||
    isHiddenPath(path)
  )
    return false;
  return !path.split("/").some((segment) => SKIPPED_FOLDERS.has(segment));
}

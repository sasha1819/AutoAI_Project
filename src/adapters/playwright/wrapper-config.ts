import { pathToFileURL } from "node:url";

export type WrapperConfigInput = {
  /** Absolute path of the user's playwright.config.* file. */
  readonly userConfig: string;
  /** Absolute path of the folder holding the spec (<repo>/tests/autoai). */
  readonly testDir: string;
  /** The spec's plain file name (already checked by isGeneratedTestFileName, so glob-safe). */
  readonly specFile: string;
  readonly outputDir: string;
  readonly reporter: string;
};

/**
 * The config AutoAI passes to the user's Playwright (ADR 0005): the user's own config, for baseURL, webServer and
 * so on, with AutoAI's settings on top. It lives in a temp folder, never in the user's repo, so every path the
 * user's config gave relative to its own folder is pinned back to that folder.
 */
export function wrapperConfigSource(input: WrapperConfigInput): string {
  const json = (value: string): string => JSON.stringify(value);
  return `import { dirname, isAbsolute, resolve } from "node:path";
import * as userModule from ${json(pathToFileURL(input.userConfig).href)};

const loaded = userModule.default ?? {};
const base = typeof loaded === "object" && loaded !== null ? loaded : {};
const configDir = dirname(${json(input.userConfig)});
const pin = (p) => (typeof p === "string" && !isAbsolute(p) ? resolve(configDir, p) : p);
const pinAll = (v) => (Array.isArray(v) ? v.map(pin) : pin(v));
const pinServer = (s) => ({ ...s, cwd: pin(s.cwd ?? ".") });

// Chromium only (MVP): use the settings of the user's Chromium project if there is one. Other projects, and
// project dependencies such as a login setup project, are not run.
const browserOf = (p) => p?.use?.browserName ?? p?.use?.defaultBrowserType ?? "chromium";
const chromium = (Array.isArray(base.projects) ? base.projects : []).find((p) => browserOf(p) === "chromium");

export default {
  ...base,
  testDir: ${json(input.testDir)},
  testMatch: ${json(input.specFile)},
  testIgnore: [],
  grep: undefined,
  grepInvert: undefined,
  projects: [{ name: "chromium" }],
  // AutoAI decides retries (core/rules/run-status.ts): Playwright must never retry on its own.
  retries: 0,
  repeatEach: 1,
  workers: 1,
  fullyParallel: false,
  maxFailures: 0,
  // Never write snapshot baselines into the user's repo.
  updateSnapshots: "none",
  reporter: [[${json(input.reporter)}]],
  outputDir: ${json(input.outputDir)},
  preserveOutput: "always",
  globalSetup: pinAll(base.globalSetup),
  globalTeardown: pinAll(base.globalTeardown),
  tsconfig: pin(base.tsconfig),
  webServer: Array.isArray(base.webServer)
    ? base.webServer.map(pinServer)
    : base.webServer
      ? pinServer(base.webServer)
      : undefined,
  use: {
    ...base.use,
    ...chromium?.use,
    browserName: "chromium",
    defaultBrowserType: "chromium",
    channel: undefined,
    screenshot: "only-on-failure",
    trace: "off",
    video: "off",
  },
};
`;
}

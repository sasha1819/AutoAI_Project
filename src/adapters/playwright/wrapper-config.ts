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
// A project that names Chromium wins over one that names no browser (setup projects usually name none).
const projects = Array.isArray(base.projects) ? base.projects : [];
const browserOf = (p) => p?.use?.browserName ?? p?.use?.defaultBrowserType;
const chromium =
  projects.find((p) => browserOf(p) === "chromium") ?? projects.find((p) => browserOf(p) === undefined);

// Setup projects the Chromium project depends on (e.g. a login step) are not run (MVP limit, LATER.md). They are
// reported so a failure's diagnosis can say so for certain.
const projectByName = new Map(projects.map((p) => [p.name, p]));
const skippedSetupProjects = [];
const visit = (names) => {
  for (const name of Array.isArray(names) ? names : []) {
    if (typeof name !== "string" || skippedSetupProjects.includes(name)) continue;
    skippedSetupProjects.push(name);
    visit(projectByName.get(name)?.dependencies);
  }
};
visit(chromium?.dependencies);
if (skippedSetupProjects.length > 0) {
  process.stdout.write(\`AUTOAI:\${JSON.stringify({ kind: "config", skippedSetupProjects })}\\n\`);
}

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

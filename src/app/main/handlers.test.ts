import { describe, expect, it, vi } from "vitest";
import { err, ok } from "../../core/domain/result.ts";
import type { ScanProgress } from "../../core/domain/scan-progress.ts";
import type { ScanResult } from "../../services/scan-project.ts";
import { type AppServices, createHandlers } from "./handlers.ts";

const emptyScan: ScanResult = {
  prdFiles: ["a.md"],
  sourceFiles: 3,
  requirements: [],
  findings: [],
  notScanned: [],
  needsReview: [],
  extraction: { files: 0, dropped: 0 },
  warnings: [{ code: "SOURCE_FILE_UNREADABLE", message: "x.js could not be read" }],
  stoppedBy: null,
  models: ["claude-sonnet-5"],
  usage: { aiCalls: 0, inputTokens: 0, outputTokens: 0 },
};
const services = (over: Partial<AppServices> = {}): AppServices => ({
  aiStatus: () => Promise.resolve(ok({ configured: true })),
  saveAiKey: () => Promise.resolve(ok(undefined)),
  checkAiKey: () => Promise.resolve(ok(undefined)),
  pickFolder: () => Promise.resolve("/chosen"),
  openLink: () => Promise.resolve(ok(undefined)),
  mockAi: false,
  readPrds: () =>
    Promise.resolve(
      ok({
        files: [{ file: "a.md", requirements: 0, chars: 10, claude: "will_read" as const }],
        requirements: 0,
        maxChars: 50000,
        extraCalls: 0,
      }),
    ),
  scan: () => Promise.resolve(ok(emptyScan)),
  ...over,
});
const noPush = () => undefined;

describe("IPC handlers", () => {
  it("ai:status passes the service's answer through", async () => {
    expect(await createHandlers(services())["ai:status"]({}, noPush)).toStrictEqual(
      ok({ configured: true }),
    );
  });

  it("ai:save-key gives the raw text to the service and answers saved, or the service's error", async () => {
    const saveAiKey = vi.fn(() => Promise.resolve(ok(undefined)));
    const h = createHandlers(services({ saveAiKey }));
    expect(await h["ai:save-key"]({ key: " sk-x " }, noPush)).toStrictEqual(ok({ saved: true }));
    expect(saveAiKey).toHaveBeenCalledWith(" sk-x ");
    const bad = err({ code: "KEY_INVALID", message: "an API key has no spaces" } as const);
    expect(
      await createHandlers(services({ saveAiKey: () => Promise.resolve(bad) }))["ai:save-key"](
        { key: "a b" },
        noPush,
      ),
    ).toStrictEqual(bad);
  });

  it("ai:check-key answers works, or the provider's error", async () => {
    expect(await createHandlers(services())["ai:check-key"]({}, noPush)).toStrictEqual(
      ok({ works: true }),
    );
    const rejected = err({ code: "AI_AUTH_FAILED", message: "rejected" } as const);
    expect(
      await createHandlers(services({ checkAiKey: () => Promise.resolve(rejected) }))[
        "ai:check-key"
      ]({}, noPush),
    ).toStrictEqual(rejected);
  });

  it("project:pick-folder returns the chosen path, or null when cancelled", async () => {
    expect(
      await createHandlers(services())["project:pick-folder"]({ purpose: "repo" }, noPush),
    ).toStrictEqual({ path: "/chosen" });
    expect(
      await createHandlers(services({ pickFolder: () => Promise.resolve(null) }))[
        "project:pick-folder"
      ]({ purpose: "prds" }, noPush),
    ).toStrictEqual({ path: null });
  });

  it("project:read-prds passes the folder to the service and its answer back", async () => {
    const seen: string[] = [];
    const readPrds: AppServices["readPrds"] = (folder) => {
      seen.push(folder);
      return Promise.resolve(ok({ files: [], requirements: 0, maxChars: 50000, extraCalls: 0 }));
    };
    expect(
      await createHandlers(services({ readPrds }))["project:read-prds"](
        { prdFolder: "/p" },
        noPush,
      ),
    ).toStrictEqual(ok({ files: [], requirements: 0, maxChars: 50000, extraCalls: 0 }));
    expect(seen).toStrictEqual(["/p"]);
    const refused = err({ code: "FOLDER_NOT_PICKED", message: "pick it" } as const);
    expect(
      await createHandlers(services({ readPrds: () => Promise.resolve(refused) }))[
        "project:read-prds"
      ]({ prdFolder: "/etc" }, noPush),
    ).toStrictEqual(refused);
  });

  it("scan:run streams progress on scan:progress and answers the report", async () => {
    const pushed: unknown[] = [];
    const scan: AppServices["scan"] = (input) => {
      const steps: ScanProgress[] = [{ stage: "reading_prds" }, { stage: "done" }];
      for (const step of steps) input.onProgress?.(step);
      return Promise.resolve(ok(emptyScan));
    };
    const reply = await createHandlers(services({ scan }))["scan:run"](
      { repoRoot: "/r", prdFolder: "/p" },
      (channel, event) => pushed.push([channel, event]),
    );
    expect(pushed).toStrictEqual([
      ["scan:progress", { progress: { stage: "reading_prds" } }],
      ["scan:progress", { progress: { stage: "done" } }],
    ]);
    expect(reply.ok && reply.value.prdFiles).toStrictEqual(["a.md"]);
  });

  it("scan:run passes the service's SCAN_BUSY through (the one-at-a-time rule lives in the service)", async () => {
    const busy = err({ code: "SCAN_BUSY", message: "A scan is already running." } as const);
    const reply = await createHandlers(services({ scan: () => Promise.resolve(busy) }))["scan:run"](
      { repoRoot: "/r", prdFolder: "/p" },
      noPush,
    );
    expect(reply).toStrictEqual(busy);
  });

  it("scan:run accepts a project with no PRD folder", async () => {
    const seen: unknown[] = [];
    const scan: AppServices["scan"] = (input) => {
      seen.push(input.prdFolder);
      return Promise.resolve(ok(emptyScan));
    };
    await createHandlers(services({ scan }))["scan:run"](
      { repoRoot: "/r", prdFolder: null },
      noPush,
    );
    expect(seen).toStrictEqual([null]);
  });

  it("app:info says whether mock AI mode is on", async () => {
    expect(await createHandlers(services())["app:info"]({}, noPush)).toStrictEqual({
      mockAi: false,
    });
    expect(await createHandlers(services({ mockAi: true }))["app:info"]({}, noPush)).toStrictEqual({
      mockAi: true,
    });
  });

  it("link:open opens the one allowlisted address", async () => {
    const openLink = vi.fn(() => Promise.resolve(ok(undefined)));
    const reply = await createHandlers(services({ openLink }))["link:open"](
      { url: "https://console.anthropic.com/" },
      noPush,
    );
    expect(reply).toStrictEqual(ok({ opened: true }));
    expect(openLink).toHaveBeenCalledWith("https://console.anthropic.com/");
  });

  it.each([
    "https://evil.example/",
    "https://console.anthropic.com.evil.example/",
    "https://console.anthropic.com/settings/keys",
    "http://console.anthropic.com/",
    "https://CONSOLE.anthropic.com/",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "",
  ])("link:open refuses %j before opening anything", async (url) => {
    const openLink = vi.fn(() => Promise.resolve(ok(undefined)));
    await expect(
      createHandlers(services({ openLink }))["link:open"]({ url }, noPush),
    ).rejects.toThrow();
    expect(openLink).not.toHaveBeenCalled();
  });

  it("link:open reports a browser that could not be opened", async () => {
    const failed = err({ code: "LINK_NOT_OPENED", message: "no browser" } as const);
    const reply = await createHandlers(services({ openLink: () => Promise.resolve(failed) }))[
      "link:open"
    ]({ url: "https://console.anthropic.com/" }, noPush);
    expect(reply).toStrictEqual(failed);
  });

  it.each([
    ["ai:save-key", { key: 42 }],
    ["ai:status", { extra: true }],
    ["project:pick-folder", { purpose: "home" }],
    ["scan:run", { repoRoot: "" }],
    ["project:read-prds", { prdFolder: "" }],
  ] as const)(
    "a request that breaks the %s contract throws (a bug in the screen)",
    async (channel, request) => {
      await expect(createHandlers(services())[channel](request, noPush)).rejects.toThrow();
    },
  );
});

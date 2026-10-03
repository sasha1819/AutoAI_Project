import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { composeApp } from "./compose.ts";
import { createHandlers } from "./handlers.ts";

// A stand-in for the OS encryption, and recorded-shape API replies: nothing reaches the keychain or the network.
const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (s: string) => Buffer.from(`ENC(${s})`),
  decryptString: (b: Buffer) => b.toString().slice(4, -1),
};
const reply = (status: number, body: unknown) => () =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
  );
const accepted = reply(200, { data: [], has_more: false, first_id: null, last_id: null });
const rejected = reply(401, {
  type: "error",
  error: { type: "authentication_error", message: "invalid x-api-key" },
});
const push = () => undefined;
const app = (fetch: typeof globalThis.fetch, opened: string[] = [], mockAi = false) =>
  createHandlers(
    composeApp({
      userDataDir: mkdtempSync(join(tmpdir(), "autoai-compose-")),
      safeStorage,
      pickFolder: () => Promise.resolve(null),
      openExternal: (url) => {
        opened.push(url);
        return Promise.resolve();
      },
      mockAi,
      fetch,
    }),
  );

describe("composeApp wires the real services and adapters to the handlers", () => {
  it("a key the provider rejects is not saved: still not configured", async () => {
    const h = app(rejected);
    const saved = await h["ai:save-key"]({ key: "sk-wrong" }, push);
    expect(saved.ok ? null : saved.error.code).toBe("AI_AUTH_FAILED");
    expect(await h["ai:status"]({}, push)).toStrictEqual({
      ok: true,
      value: { configured: false },
    });
  });

  it("an accepted key is saved: configured, and no reply holds the key", async () => {
    const h = app(accepted);
    expect(await h["ai:save-key"]({ key: "sk-composed-1" }, push)).toStrictEqual({
      ok: true,
      value: { saved: true },
    });
    const status = await h["ai:status"]({}, push);
    expect(status).toStrictEqual({ ok: true, value: { configured: true } });
    expect(JSON.stringify(status)).not.toContain("sk-composed-1");
    expect(await h["ai:check-key"]({}, push)).toStrictEqual({ ok: true, value: { works: true } });
  });

  it("link:open hands the allowlisted address to the system browser; a failing browser is LINK_NOT_OPENED", async () => {
    const opened: string[] = [];
    const h = app(accepted, opened);
    expect(await h["link:open"]({ url: "https://console.anthropic.com/" }, push)).toStrictEqual({
      ok: true,
      value: { opened: true },
    });
    expect(opened.at(-1)).toBe("https://console.anthropic.com/");
    const broken = createHandlers(
      composeApp({
        userDataDir: mkdtempSync(join(tmpdir(), "autoai-compose-")),
        safeStorage,
        pickFolder: () => Promise.resolve(null),
        openExternal: () => Promise.reject(new Error("no default browser")),
        mockAi: false,
        fetch: accepted,
      }),
    );
    const reply = await broken["link:open"]({ url: "https://console.anthropic.com/" }, push);
    expect(reply.ok ? null : reply.error.code).toBe("LINK_NOT_OPENED");
  });

  it("mock mode: a mock-format key works, another is rejected, and the OS keychain is never touched", async () => {
    const keychain = { ...safeStorage, used: 0 };
    const counting = {
      isEncryptionAvailable: () => true,
      encryptString: (t: string) => {
        keychain.used += 1;
        return safeStorage.encryptString(t);
      },
      decryptString: (b: Buffer) => {
        keychain.used += 1;
        return safeStorage.decryptString(b);
      },
    };
    const h = createHandlers(
      composeApp({
        userDataDir: mkdtempSync(join(tmpdir(), "autoai-compose-")),
        safeStorage: counting,
        pickFolder: () => Promise.resolve(null),
        openExternal: () => Promise.resolve(),
        mockAi: true,
        // A real network call would fail this test: mock mode must not make one.
        fetch: () => Promise.reject(new Error("mock mode reached the network")),
      }),
    );
    const mockKey = ["mock", "dev", "key"].join("-");
    const wrong = await h["ai:save-key"]({ key: ["real", "looking", "key"].join("-") }, push);
    expect(wrong.ok ? null : wrong.error.code).toBe("AI_AUTH_FAILED");
    expect(await h["ai:save-key"]({ key: mockKey }, push)).toStrictEqual({
      ok: true,
      value: { saved: true },
    });
    expect(await h["ai:status"]({}, push)).toStrictEqual({ ok: true, value: { configured: true } });
    expect(await h["app:info"]({}, push)).toStrictEqual({ mockAi: true });
    expect(keychain.used).toBe(0);
  });

  it("main reads only folders picked in the dialog: anything else is FOLDER_NOT_PICKED, before any read", async () => {
    const root = mkdtempSync(join(tmpdir(), "autoai-picked-"));
    const prds = join(root, "docs");
    mkdirSync(prds);
    writeFileSync(join(prds, "cart.md"), "Cart 2.4: Codes are case-insensitive.");
    writeFileSync(join(prds, "vision.md"), "We want a fast checkout.");
    const answers: (string | null)[] = [root, prds];
    const h = createHandlers(
      composeApp({
        userDataDir: mkdtempSync(join(tmpdir(), "autoai-compose-")),
        safeStorage,
        pickFolder: () => Promise.resolve(answers.shift() ?? null),
        openExternal: () => Promise.resolve(),
        mockAi: false,
        fetch: () => Promise.reject(new Error("no network in this test")),
      }),
    );
    const refusedRead = await h["project:read-prds"]({ prdFolder: prds }, push);
    expect(refusedRead.ok ? null : refusedRead.error.code).toBe("FOLDER_NOT_PICKED");
    const refusedScan = await h["scan:run"]({ repoRoot: root, prdFolder: null }, push);
    expect(refusedScan.ok ? null : refusedScan.error.code).toBe("FOLDER_NOT_PICKED");

    await h["project:pick-folder"]({ purpose: "repo" }, push);
    await h["project:pick-folder"]({ purpose: "prds" }, push);
    expect(await h["project:read-prds"]({ prdFolder: prds }, push)).toStrictEqual({
      ok: true,
      value: {
        files: [
          { file: "cart.md", requirements: 1 },
          { file: "vision.md", requirements: 0 },
        ],
        requirements: 1,
      },
    });
    // The repo picked as a PRD folder, or a PRD folder sent as the repo: still refused.
    const swapped = await h["project:read-prds"]({ prdFolder: root }, push);
    expect(swapped.ok ? null : swapped.error.code).toBe("FOLDER_NOT_PICKED");
    const outside = await h["scan:run"]({ repoRoot: root, prdFolder: tmpdir() }, push);
    expect(outside.ok ? null : outside.error.code).toBe("FOLDER_NOT_PICKED");
    // A picked pair reaches the scan service (no key saved here, so it stops at NO_KEY, before any AI call).
    const scanned = await h["scan:run"]({ repoRoot: root, prdFolder: prds }, push);
    expect(scanned.ok ? null : scanned.error.code).toBe("NO_KEY");
  });
});

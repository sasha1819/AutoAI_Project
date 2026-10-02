import { mkdtempSync } from "node:fs";
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
const app = (fetch: typeof globalThis.fetch) =>
  createHandlers(
    composeApp({
      userDataDir: mkdtempSync(join(tmpdir(), "autoai-compose-")),
      safeStorage,
      pickFolder: () => Promise.resolve(null),
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
});

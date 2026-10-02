import { describe, expect, it } from "vitest";
import { eventChannels, invokeChannels } from "./channels.ts";

describe("IPC contracts", () => {
  it("every reply is a Result with a closed list of codes", () => {
    expect(
      invokeChannels["ai:status"].response.safeParse({ ok: true, value: { configured: true } })
        .success,
    ).toBe(true);
    expect(
      invokeChannels["ai:check-key"].response.safeParse({
        ok: false,
        error: { code: "AI_AUTH_FAILED", message: "x" },
      }).success,
    ).toBe(true);
    expect(
      invokeChannels["ai:check-key"].response.safeParse({
        ok: false,
        error: { code: "SOMETHING_ELSE", message: "x" },
      }).success,
    ).toBe(false);
  });

  it("no reply can carry the key back: ai:status allows only configured", () => {
    expect(
      invokeChannels["ai:status"].response.safeParse({
        ok: true,
        value: { configured: true, key: "sk-x" },
      }).success,
    ).toBe(false);
  });

  it.each([
    ["ai:save-key", { key: "k".repeat(5000) }],
    ["ai:save-key", { key: "x", extra: true }],
    ["project:pick-folder", { purpose: "anything" }],
    ["scan:run", { repoRoot: "", prdFolder: "prds" }],
  ] as const)("refuses a bad %s request", (channel, request) => {
    expect(invokeChannels[channel].request.safeParse(request).success).toBe(false);
  });

  it("a cancelled folder pick is a null path", () => {
    expect(invokeChannels["project:pick-folder"].response.parse({ path: null })).toStrictEqual({
      path: null,
    });
  });

  it("progress events carry a valid stage only", () => {
    expect(eventChannels["scan:progress"].safeParse({ progress: { stage: "done" } }).success).toBe(
      true,
    );
    expect(
      eventChannels["scan:progress"].safeParse({ progress: { stage: "halfway" } }).success,
    ).toBe(false);
  });
});

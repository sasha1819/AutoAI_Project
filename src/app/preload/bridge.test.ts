import { describe, expect, it, vi } from "vitest";
import { createBridge, type IpcRendererLike } from "./bridge.ts";

function fakeIpc(reply: unknown) {
  const listeners = new Map<string, (event: unknown, payload: unknown) => void>();
  const ipc: IpcRendererLike = {
    invoke: vi.fn(() => Promise.resolve(reply)),
    on: (channel, listener) => listeners.set(channel, listener),
    removeListener: (channel) => listeners.delete(channel),
  };
  return {
    ipc,
    emit: (channel: string, payload: unknown) => listeners.get(channel)?.(null, payload),
    listeners,
  };
}

describe("the preload bridge", () => {
  it("passes a request to main and returns its validated reply", async () => {
    const { ipc } = fakeIpc({ ok: true, value: { configured: false } });
    const reply = await createBridge(ipc).invoke("ai:status", {});
    expect(reply).toStrictEqual({ ok: true, value: { configured: false } });
    expect(ipc.invoke).toHaveBeenCalledWith("ai:status", {});
  });

  it("a reply that breaks its contract is a loud error, never data", async () => {
    const { ipc } = fakeIpc({ ok: true, value: { configured: false, key: "sk-leak" } });
    await expect(createBridge(ipc).invoke("ai:status", {})).rejects.toThrow();
  });

  it("refuses a channel that does not exist, without calling main", async () => {
    const { ipc } = fakeIpc(null);
    // @ts-expect-error not a channel
    await expect(createBridge(ipc).invoke("fs:read", {})).rejects.toThrow(/no such channel/);
    expect(ipc.invoke).not.toHaveBeenCalled();
  });

  it("delivers valid events, drops invalid ones, and stops when asked", () => {
    const { ipc, emit, listeners } = fakeIpc(null);
    const seen: unknown[] = [];
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const stop = createBridge(ipc).on("scan:progress", (e) => seen.push(e));
    emit("scan:progress", { progress: { stage: "done" } });
    emit("scan:progress", { progress: { stage: "nonsense" } });
    expect(seen).toStrictEqual([{ progress: { stage: "done" } }]);
    expect(errorLog).toHaveBeenCalledOnce();
    stop();
    expect(listeners.has("scan:progress")).toBe(false);
    errorLog.mockRestore();
  });
});

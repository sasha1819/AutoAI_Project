import {
  type ChannelEvent,
  type ChannelResponse,
  type EventChannel,
  type InvokeChannel,
  invokeChannels,
} from "../../contracts/channels.ts";
import type { aiKeyStatus, checkAiKey, saveAiKey } from "../../services/connect-ai.ts";
import type { ScanInput, createScanRunner } from "../../services/scan-with-stored-key.ts";

/** What the handlers need: one call per channel, built in compose.ts from the services (same result types). */
export type AppServices = {
  readonly aiStatus: () => ReturnType<typeof aiKeyStatus>;
  readonly saveAiKey: (key: string) => ReturnType<typeof saveAiKey>;
  readonly checkAiKey: () => ReturnType<typeof checkAiKey>;
  /** The system folder dialog; null when cancelled. */
  readonly pickFolder: (purpose: "repo" | "prds") => Promise<string | null>;
  readonly scan: (input: ScanInput) => ReturnType<ReturnType<typeof createScanRunner>["scan"]>;
};

export type Push = <E extends EventChannel>(channel: E, event: ChannelEvent<E>) => void;
export type Handlers = {
  readonly [C in InvokeChannel]: (request: unknown, push: Push) => Promise<ChannelResponse<C>>;
};

/**
 * The IPC handlers: validate the request against its contract, call one service, shape the reply to the contract.
 * No rules here (ARCHITECTURE §2). A request that fails its schema is a bug in the screen: it throws, and the
 * screen's invoke rejects. Replies are typed by their contracts, so a service error code a contract does not
 * list does not compile.
 */
export function createHandlers(services: AppServices): Handlers {
  return {
    "ai:status": async (raw) => {
      invokeChannels["ai:status"].request.parse(raw);
      return services.aiStatus();
    },
    "ai:save-key": async (raw) => {
      const { key } = invokeChannels["ai:save-key"].request.parse(raw);
      const saved = await services.saveAiKey(key);
      return saved.ok ? { ok: true, value: { saved: true } } : saved;
    },
    "ai:check-key": async (raw) => {
      invokeChannels["ai:check-key"].request.parse(raw);
      const checked = await services.checkAiKey();
      return checked.ok ? { ok: true, value: { works: true } } : checked;
    },
    "project:pick-folder": async (raw) => {
      const { purpose } = invokeChannels["project:pick-folder"].request.parse(raw);
      return { path: await services.pickFolder(purpose) };
    },
    "scan:run": async (raw, push) => {
      const input = invokeChannels["scan:run"].request.parse(raw);
      const result = await services.scan({
        ...input,
        onProgress: (progress) => {
          push("scan:progress", { progress });
        },
      });
      if (!result.ok) return result;
      const { warnings, stoppedBy, ...rest } = result.value;
      return {
        ok: true,
        value: {
          ...rest,
          warnings: warnings.map((w) => ({ code: w.code, message: w.message })),
          stoppedBy:
            stoppedBy === null ? null : { code: stoppedBy.code, message: stoppedBy.message },
        },
      };
    },
  };
}

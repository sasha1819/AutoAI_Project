import {
  type ChannelEvent,
  type ChannelResponse,
  type EventChannel,
  type InvokeChannel,
  invokeChannels,
} from "../../contracts/channels.ts";
import type { DomainError } from "../../core/domain/domain-error.ts";
import type { Result } from "../../core/domain/result.ts";
import type { ExternalLink } from "../../contracts/links.ts";
import type { aiKeyStatus, checkAiKey, saveAiKey } from "../../services/connect-ai.ts";
import type { ExtractRequirementsError } from "../../services/extract-requirements.ts";
import type { ScanResult } from "../../services/scan-project.ts";
import type { ScanInput, ScanWithStoredKeyError } from "../../services/scan-with-stored-key.ts";
import type { PrdSummary } from "../../services/summarize-prds.ts";

type NotPicked = DomainError<"FOLDER_NOT_PICKED">;

/** What the handlers need: one call per channel, built in compose.ts from the services (same result types). */
export type AppServices = {
  readonly aiStatus: () => ReturnType<typeof aiKeyStatus>;
  readonly saveAiKey: (key: string) => ReturnType<typeof saveAiKey>;
  readonly checkAiKey: () => ReturnType<typeof checkAiKey>;
  /** The system folder dialog; null when cancelled. */
  readonly pickFolder: (purpose: "repo" | "prds") => Promise<string | null>;
  /** Whether the app runs with the mock AI (development only). */
  readonly mockAi: boolean;
  /** Opens an allowlisted address in the user's default browser. */
  readonly openLink: (
    url: ExternalLink,
  ) => Promise<Result<undefined, DomainError<"LINK_NOT_OPENED">>>;
  /** Only folders picked in the dialog (FOLDER_NOT_PICKED otherwise). */
  readonly readPrds: (
    prdFolder: string,
  ) => Promise<Result<PrdSummary, ExtractRequirementsError | NotPicked>>;
  /** Only folders picked in the dialog (FOLDER_NOT_PICKED otherwise). */
  readonly scan: (
    input: ScanInput,
  ) => Promise<Result<ScanResult, ScanWithStoredKeyError | NotPicked>>;
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
    "project:read-prds": async (raw) => {
      const { prdFolder } = invokeChannels["project:read-prds"].request.parse(raw);
      return services.readPrds(prdFolder);
    },
    "app:info": (raw) => {
      invokeChannels["app:info"].request.parse(raw);
      return Promise.resolve({ mockAi: services.mockAi });
    },
    "link:open": async (raw) => {
      // The schema is the allowlist: any address not on it throws here, before anything is opened.
      const { url } = invokeChannels["link:open"].request.parse(raw);
      const opened = await services.openLink(url);
      return opened.ok ? { ok: true, value: { opened: true } } : opened;
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

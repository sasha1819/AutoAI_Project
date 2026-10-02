import {
  type AutoAiBridge,
  eventChannels,
  invokeChannels,
  parseEvent,
  parseResponse,
} from "../../contracts/channels.ts";

/** The parts of Electron's ipcRenderer the bridge uses (passed in, so it is testable without Electron). */
export type IpcRendererLike = {
  readonly invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  readonly on: (channel: string, listener: (event: unknown, payload: unknown) => void) => void;
  readonly removeListener: (
    channel: string,
    listener: (event: unknown, payload: unknown) => void,
  ) => void;
};

/**
 * `window.autoai` (ADR 0007): the screens' only way to main. Only the listed channels exist; every reply and event
 * is validated against its contract before a screen sees it, so a reply that breaks its contract is a loud bug,
 * never quiet bad data.
 */
export function createBridge(ipc: IpcRendererLike): AutoAiBridge {
  return {
    invoke: async (channel, request) => {
      if (!Object.hasOwn(invokeChannels, channel)) throw new Error(`no such channel: ${channel}`);
      return parseResponse[channel](await ipc.invoke(channel, request));
    },
    on: (channel, listener) => {
      if (!Object.hasOwn(eventChannels, channel))
        throw new Error(`no such event channel: ${channel}`);
      const wrapped = (_event: unknown, payload: unknown) => {
        const event = parseEvent[channel](payload);
        if (event === null) console.error(`dropped an invalid ${channel} event`);
        else listener(event);
      };
      ipc.on(channel, wrapped);
      return () => {
        ipc.removeListener(channel, wrapped);
      };
    },
  };
}

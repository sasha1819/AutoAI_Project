import type { z } from "zod";
import { aiCheckKey, aiSaveKey, aiStatus } from "./ai.ts";
import { projectPickFolder } from "./project.ts";
import { ScanProgressEvent, scanRun } from "./scan.ts";

/** Every request/reply channel between the screens and main (ADR 0007). Main validates requests, the preload replies. */
export const invokeChannels = {
  "ai:status": aiStatus,
  "ai:save-key": aiSaveKey,
  "ai:check-key": aiCheckKey,
  "project:pick-folder": projectPickFolder,
  "scan:run": scanRun,
} as const;
export type InvokeChannel = keyof typeof invokeChannels;
/** The request/reply channel names, for registering them all. */
export const INVOKE_CHANNELS: readonly InvokeChannel[] = Object.keys(invokeChannels).filter(
  (name): name is InvokeChannel => Object.hasOwn(invokeChannels, name),
);
export type ChannelRequest<C extends InvokeChannel> = z.input<
  (typeof invokeChannels)[C]["request"]
>;
export type ChannelResponse<C extends InvokeChannel> = z.infer<
  (typeof invokeChannels)[C]["response"]
>;

/** Every channel main pushes on. */
export const eventChannels = { "scan:progress": ScanProgressEvent } as const;
export type EventChannel = keyof typeof eventChannels;
export type ChannelEvent<E extends EventChannel> = z.infer<(typeof eventChannels)[E]>;

/** One parser per channel, so a generic channel name keeps its own reply type (no casts at the call sites). */
export const parseResponse: {
  readonly [C in InvokeChannel]: (reply: unknown) => ChannelResponse<C>;
} = {
  "ai:status": (v) => invokeChannels["ai:status"].response.parse(v),
  "ai:save-key": (v) => invokeChannels["ai:save-key"].response.parse(v),
  "ai:check-key": (v) => invokeChannels["ai:check-key"].response.parse(v),
  "project:pick-folder": (v) => invokeChannels["project:pick-folder"].response.parse(v),
  "scan:run": (v) => invokeChannels["scan:run"].response.parse(v),
};
/** One checker per event channel: the event, or null when it breaks its contract. */
export const parseEvent: {
  readonly [E in EventChannel]: (event: unknown) => ChannelEvent<E> | null;
} = {
  "scan:progress": (v) => {
    const parsed = eventChannels["scan:progress"].safeParse(v);
    return parsed.success ? parsed.data : null;
  },
};

/** What the preload exposes as `window.autoai`, the screens' only way out. */
export type AutoAiBridge = {
  readonly invoke: <C extends InvokeChannel>(
    channel: C,
    request: ChannelRequest<C>,
  ) => Promise<ChannelResponse<C>>;
  /** Listens on an event channel; returns the function that stops listening. */
  readonly on: <E extends EventChannel>(
    channel: E,
    listener: (event: ChannelEvent<E>) => void,
  ) => () => void;
};

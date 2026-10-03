import type {
  AutoAiBridge,
  ChannelEvent,
  EventChannel,
  ChannelRequest,
  ChannelResponse,
  InvokeChannel,
} from "../../../contracts/channels.ts";
import { parseEvent } from "../../../contracts/channels.ts";

type Answers = {
  readonly [C in InvokeChannel]?: (request: ChannelRequest<C>) => Promise<ChannelResponse<C>>;
};
export type FakeBridge = {
  readonly calls: { readonly channel: InvokeChannel; readonly request: unknown }[];
  /** Pushes an event to whoever listens on the channel, as main does (e.g. scan progress). */
  readonly emit: <E extends EventChannel>(channel: E, event: ChannelEvent<E>) => void;
  /** How many listeners are on a channel right now. */
  readonly listening: (channel: EventChannel) => number;
};

/**
 * For feature tests of a `useX` hook (ARCHITECTURE §7): puts a fake `window.autoai` on the page that answers the
 * listed channels and records every call. A channel without an answer fails the test loudly.
 */
export function installFakeBridge(answers: Answers): FakeBridge {
  const calls: FakeBridge["calls"] = [];
  const listeners = new Map<EventChannel, Set<(event: unknown) => void>>();
  const listenersOf = (channel: EventChannel) => {
    const found = listeners.get(channel) ?? new Set();
    listeners.set(channel, found);
    return found;
  };
  const fake: AutoAiBridge = {
    invoke: (channel, request) => {
      calls.push({ channel, request });
      const answer: ((r: typeof request) => Promise<ChannelResponse<typeof channel>>) | undefined =
        answers[channel];
      if (answer === undefined) throw new Error(`the fake bridge has no answer for ${channel}`);
      return answer(request);
    },
    on: (channel, listener) => {
      // Events are checked against their contract, as the real preload does.
      const wrapped = (event: unknown) => {
        const parsed = parseEvent[channel](event);
        if (parsed === null) throw new Error(`the fake bridge got a bad ${channel} event`);
        listener(parsed);
      };
      listenersOf(channel).add(wrapped);
      return () => {
        listenersOf(channel).delete(wrapped);
      };
    },
  };
  Object.defineProperty(window, "autoai", { value: fake, configurable: true });
  return {
    calls,
    emit: (channel, event) => {
      for (const listener of listenersOf(channel)) listener(event);
    },
    listening: (channel) => listenersOf(channel).size,
  };
}

/** Takes the fake bridge away again (call in afterEach). */
export function removeFakeBridge(): void {
  Reflect.deleteProperty(window, "autoai");
}

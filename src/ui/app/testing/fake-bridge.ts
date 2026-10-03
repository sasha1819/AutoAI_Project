import type {
  AutoAiBridge,
  ChannelRequest,
  ChannelResponse,
  InvokeChannel,
} from "../../../contracts/channels.ts";

type Answers = {
  readonly [C in InvokeChannel]?: (request: ChannelRequest<C>) => Promise<ChannelResponse<C>>;
};
export type FakeBridge = {
  readonly calls: { readonly channel: InvokeChannel; readonly request: unknown }[];
};

/**
 * For feature tests of a `useX` hook (ARCHITECTURE §7): puts a fake `window.autoai` on the page that answers the
 * listed channels and records every call. A channel without an answer fails the test loudly.
 */
export function installFakeBridge(answers: Answers): FakeBridge {
  const calls: FakeBridge["calls"] = [];
  const fake: AutoAiBridge = {
    invoke: (channel, request) => {
      calls.push({ channel, request });
      const answer: ((r: typeof request) => Promise<ChannelResponse<typeof channel>>) | undefined =
        answers[channel];
      if (answer === undefined) throw new Error(`the fake bridge has no answer for ${channel}`);
      return answer(request);
    },
    on: () => () => undefined,
  };
  Object.defineProperty(window, "autoai", { value: fake, configurable: true });
  return { calls };
}

/** Takes the fake bridge away again (call in afterEach). */
export function removeFakeBridge(): void {
  Reflect.deleteProperty(window, "autoai");
}

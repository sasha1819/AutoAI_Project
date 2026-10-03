import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { ConnectAiView, type ConnectAiViewProps } from "./ConnectAi.tsx";
import { SAVE_KEY_MESSAGE, STATUS_MESSAGE } from "./messages.ts";

const noop = () => undefined;
const base: ConnectAiViewProps = {
  connection: "missing",
  keyText: "",
  onKeyTextChange: noop,
  onSave: noop,
  saving: false,
  replacing: false,
  onReplace: noop,
  onCancelReplace: noop,
  onContinue: noop,
  onOpenConsole: noop,
  onSetUpLater: noop,
};
const Frame = (Story: () => ReactNode) => <div className="h-screen bg-canvas">{Story()}</div>;

const meta: Meta<typeof ConnectAiView> = {
  title: "Screens/ConnectAi",
  component: ConnectAiView,
  args: base,
  parameters: { layout: "fullscreen" },
  decorators: [Frame],
};
export default meta;
type Story = StoryObj<typeof ConnectAiView>;

export const LookingForASavedKey: Story = { args: { connection: "loading" } };
export const NoKeyYet: Story = {};
export const KeyTyped: Story = { args: { keyText: "sk-ant-example" } };
export const Checking: Story = { args: { keyText: "sk-ant-example", saving: true } };
export const Rejected: Story = {
  args: { keyText: "sk-ant-example", error: SAVE_KEY_MESSAGE.AI_AUTH_FAILED },
};
export const NoNetwork: Story = {
  args: { keyText: "sk-ant-example", error: SAVE_KEY_MESSAGE.AI_UNAVAILABLE },
};
export const NoKeychain: Story = {
  args: { keyText: "sk-ant-example", error: SAVE_KEY_MESSAGE.SECRET_STORE_UNAVAILABLE },
};
export const Connected: Story = { args: { connection: "connected" } };
export const Replacing: Story = { args: { connection: "connected", replacing: true } };
export const ReplacingChecking: Story = {
  args: { connection: "connected", replacing: true, keyText: "sk-ant-example", saving: true },
};
export const ReplacingRejected: Story = {
  args: {
    connection: "connected",
    replacing: true,
    keyText: "sk-ant-example",
    error: SAVE_KEY_MESSAGE.AI_AUTH_FAILED,
  },
};
// A key was saved, but this computer can't read it now: says why, asks for the key.
export const KeyUnreadable: Story = { args: { notice: STATUS_MESSAGE.SECRET_STORE_UNAVAILABLE } };
// The smallest window the app allows (1024 x 680).
export const SmallestWindow: Story = {
  decorators: [(Story) => <div className="h-170 w-256 overflow-auto bg-canvas">{Story()}</div>],
  args: { keyText: "sk-ant-example", error: SAVE_KEY_MESSAGE.AI_AUTH_FAILED },
};

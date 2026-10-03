import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { WelcomeView } from "./Welcome.tsx";

const meta: Meta<typeof WelcomeView> = {
  title: "Screens/Welcome",
  component: WelcomeView,
  args: { onGetStarted: () => undefined },
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof WelcomeView>;

// Mockup 1. Rendered as App renders it: inside the full-height main.
const Frame = (Story: () => ReactNode) => <div className="h-screen bg-canvas">{Story()}</div>;
export const Default: Story = { decorators: [Frame] };
// The smallest window the app allows (1024 x 680): nothing overlaps or scrolls sideways.
export const SmallestWindow: Story = {
  decorators: [(Story) => <div className="h-170 w-256 overflow-auto bg-canvas">{Story()}</div>],
};

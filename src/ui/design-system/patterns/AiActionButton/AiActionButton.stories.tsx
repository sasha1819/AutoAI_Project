import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../primitives/Button/index.ts";
import { AiActionButton } from "./AiActionButton.tsx";

const meta: Meta<typeof AiActionButton> = {
  title: "Patterns/AiActionButton",
  component: AiActionButton,
  args: { label: "Start an AI action", onClick: () => undefined },
};
export default meta;
type Story = StoryObj<typeof AiActionButton>;

export const Default: Story = {};
export const Hover: Story = {
  render: (args) => (
    <div data-preview-state="hover">
      <AiActionButton {...args} />
    </div>
  ),
};
export const FocusVisible: Story = {
  render: (args) => (
    <div data-preview-state="focus-visible">
      <AiActionButton {...args} />
    </div>
  ),
};
export const Loading: Story = { args: { loading: true } };
export const Disabled: Story = { args: { disabled: true } };
export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <AiActionButton {...args} size="sm" />
      <AiActionButton {...args} size="md" />
      <AiActionButton {...args} size="lg" />
    </div>
  ),
};
// Beside ordinary actions, as in a finding card (mockup 11).
export const InActionRow: Story = {
  render: (args) => (
    <div className="flex gap-2">
      <AiActionButton {...args} />
      <Button variant="secondary">Secondary action</Button>
      <Button variant="secondary">Another action</Button>
    </div>
  ),
};

// Fills a side panel's column (the fix action in mockups 7 and 14).
export const FullWidth: Story = {
  args: { fullWidth: true },
  decorators: [(Story) => <div className="w-80 rounded-card bg-surface p-4">{Story()}</div>],
};

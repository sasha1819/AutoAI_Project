import type { Meta, StoryObj } from "@storybook/react-vite";
import { SeverityTag } from "./SeverityTag.tsx";

const meta: Meta<typeof SeverityTag> = {
  title: "Patterns/SeverityTag",
  component: SeverityTag,
  args: { severity: "high" },
  argTypes: { severity: { control: "inline-radio", options: ["high", "medium", "low"] } },
};
export default meta;
type Story = StoryObj<typeof SeverityTag>;

export const High: Story = {};
export const Medium: Story = { args: { severity: "medium" } };
export const Low: Story = { args: { severity: "low" } };
// As in a finding card's header (mockup 11), on the card surface.
export const AllOnCard: Story = {
  render: () => (
    <div className="flex gap-2 rounded-card bg-surface p-4">
      <SeverityTag severity="high" />
      <SeverityTag severity="medium" />
      <SeverityTag severity="low" />
    </div>
  ),
};

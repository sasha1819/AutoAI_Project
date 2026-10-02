import type { Meta, StoryObj } from "@storybook/react-vite";
import { Confidence } from "../../../../core/domain/finding.ts";
import { ConfidenceMeter } from "./ConfidenceMeter.tsx";

const meta: Meta<typeof ConfidenceMeter> = {
  title: "Patterns/ConfidenceMeter",
  component: ConfidenceMeter,
};
export default meta;
type Story = StoryObj<typeof ConfidenceMeter>;

export const High: Story = { args: { confidence: Confidence.parse(0.92) } };
export const Middle: Story = { args: { confidence: Confidence.parse(0.62) } };
export const Low: Story = { args: { confidence: Confidence.parse(0.18) } };
export const Ends: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <ConfidenceMeter confidence={Confidence.parse(0)} />
      <ConfidenceMeter confidence={Confidence.parse(1)} />
    </div>
  ),
};

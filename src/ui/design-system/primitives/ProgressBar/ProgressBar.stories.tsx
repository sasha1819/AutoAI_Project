import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProgressBar } from "./ProgressBar.tsx";

const meta: Meta<typeof ProgressBar> = {
  title: "Primitives/ProgressBar",
  component: ProgressBar,
  args: { label: "Progress", value: 4, max: 9 },
  decorators: [(Story) => <div className="w-80">{Story()}</div>],
};
export default meta;
type Story = StoryObj<typeof ProgressBar>;

export const Default: Story = {};
export const WithValueText: Story = { args: { valueText: "4 of 9 done" } };
export const Empty: Story = { args: { value: 0, valueText: "0 of 9 done" } };
export const Complete: Story = { args: { value: 9, valueText: "9 of 9 done" } };
// No value: the total is not known yet. With reduced motion the third stays still in the middle.
export const Indeterminate: Story = {
  render: () => <ProgressBar label="Progress" valueText="Working…" />,
};
export const IndeterminateNoText: Story = { render: () => <ProgressBar label="Progress" /> };

// On every surface a bar can sit on.
export const OnSurfaces: Story = {
  render: (args) => (
    <div className="flex flex-col gap-3">
      {(["bg-canvas", "bg-surface", "bg-sunken", "bg-selected"] as const).map((bg) => (
        <div key={bg} className={`rounded-card p-4 ${bg}`}>
          <ProgressBar {...args} valueText="4 of 9 done" />
        </div>
      ))}
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { AiChip, AiMark } from "./AiChip.tsx";

const meta: Meta<typeof AiChip> = {
  title: "Patterns/AiChip",
  component: AiChip,
  args: { label: "Something found by Claude" },
};
export default meta;
type Story = StoryObj<typeof AiChip>;

// Mockup 11: marks a result as Claude's, at the top of a page.
export const Chip: Story = {};
export const LongLabelNarrow: Story = {
  args: { label: "A long description of what Claude found in this project" },
  decorators: [(Story) => <div className="flex w-56">{Story()}</div>],
};
// Beside a page title in a narrow header (mockup 11): the title keeps its width, the chip truncates.
export const BesideTitleNarrow: Story = {
  render: () => (
    <div className="flex w-96 items-center justify-between gap-4">
      <h2 className="shrink-0 text-xl font-bold text-text-primary">A page title</h2>
      <AiChip label="A long description of what Claude found in this project" />
    </div>
  ),
};
// Mockups 7 and 14: before an AI panel's title; the title says it, so the mark is decorative.
export const MarkInPanelHeader: Story = {
  render: () => (
    <div className="flex w-80 items-center gap-2.5 rounded-card bg-surface p-4">
      <AiMark decorative />
      <h3 className="text-md font-semibold text-text-primary">A panel written by Claude</h3>
    </div>
  ),
};
export const MarkLabelled: Story = { render: () => <AiMark label="From Claude" /> };
// On every surface it sits on.
export const OnSurfaces: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      {(["bg-canvas", "bg-surface", "bg-sunken"] as const).map((bg) => (
        <div key={bg} className={`flex items-center gap-3 rounded-card p-3 ${bg}`}>
          <AiChip label="Something found by Claude" />
          <AiMark decorative />
        </div>
      ))}
    </div>
  ),
};

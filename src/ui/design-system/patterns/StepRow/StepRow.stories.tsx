import type { Meta, StoryObj } from "@storybook/react-vite";
import { StepRow } from "./StepRow.tsx";

const meta: Meta<typeof StepRow> = {
  title: "Patterns/StepRow",
  component: StepRow,
  args: { name: "A step of the test", status: "passed" },
  argTypes: {
    status: {
      control: "inline-radio",
      options: ["passed", "failed", "flaky", "running", "not_run"],
    },
  },
  decorators: [(Story) => <div className="w-60 bg-surface px-4">{Story()}</div>],
};
export default meta;
type Story = StoryObj<typeof StepRow>;

export const Passed: Story = { args: { durationMs: 1200 } };
export const Failed: Story = { args: { status: "failed", durationMs: 10_000 } };
export const Running: Story = { args: { status: "running" } };
export const NotRun: Story = { args: { status: "not_run" } };
export const LongName: Story = {
  args: { name: "A step with a very long description that has to truncate", durationMs: 1200 },
};
// A whole run's steps, as mockup 7's left column (in a screen they sit in a SidebarList to be selectable).
export const AStepList: Story = {
  render: () => (
    <div className="flex flex-col">
      <StepRow name="First step" status="passed" durationMs={1200} />
      <StepRow name="Second step" status="passed" durationMs={3400} />
      <StepRow name="Third step" status="failed" durationMs={10_000} />
      <StepRow name="Fourth step" status="not_run" />
      <StepRow name="Fifth step" status="not_run" />
    </div>
  ),
};

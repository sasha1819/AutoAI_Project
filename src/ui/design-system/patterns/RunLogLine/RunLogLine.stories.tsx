import type { Meta, StoryObj } from "@storybook/react-vite";
import { RunLog, RunLogLine } from "./RunLogLine.tsx";

const meta: Meta<typeof RunLog> = {
  title: "Patterns/RunLogLine",
  component: RunLog,
  decorators: [(Story) => <div className="w-120 bg-surface p-3">{Story()}</div>],
};
export default meta;
type Story = StoryObj<typeof RunLog>;

// A run in progress, as mockup 4's run log: done lines, the current one highlighted, lines not reached yet muted.
export const InProgress: Story = {
  render: () => (
    <RunLog label="Example run log">
      <RunLogLine atMs={0} status="passed" text="First thing that happened" durationMs={1200} />
      <RunLogLine atMs={1200} status="passed" text="Second thing that happened" durationMs={3400} />
      <RunLogLine atMs={6500} status="running" text="The step running now" current />
      <RunLogLine status="not_run" text="A step not reached yet" />
    </RunLog>
  ),
};
export const Finished: Story = {
  render: () => (
    <RunLog label="Example run log">
      <RunLogLine atMs={0} status="passed" text="First thing that happened" durationMs={1200} />
      <RunLogLine
        atMs={1200}
        status="failed"
        text="A step that failed and has a long description that truncates"
        durationMs={10_000}
      />
      <RunLogLine status="not_run" text="A step not reached" />
    </RunLog>
  ),
};

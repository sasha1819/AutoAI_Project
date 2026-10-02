import type { Meta, StoryObj } from "@storybook/react-vite";
import { type PillStatus, StatusPill } from "./StatusPill.tsx";

const meta: Meta<typeof StatusPill> = {
  title: "Patterns/StatusPill",
  component: StatusPill,
  args: { status: "failed" },
  argTypes: {
    status: {
      control: "inline-radio",
      options: ["passed", "failed", "flaky", "running", "not_run"],
    },
  },
};
export default meta;
type Story = StoryObj<typeof StatusPill>;

export const Failed: Story = {};
export const Passed: Story = { args: { status: "passed" } };
export const Flaky: Story = { args: { status: "flaky" } };
export const Running: Story = { args: { status: "running" } };
export const NotRun: Story = { args: { status: "not_run" } };

const ALL: readonly PillStatus[] = ["passed", "failed", "flaky", "running", "not_run"];
// On every surface a pill sits on.
export const AllOnSurfaces: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      {(["bg-canvas", "bg-surface", "bg-sunken", "bg-selected"] as const).map((bg) => (
        <div key={bg} className={`flex gap-2 rounded-card p-3 ${bg}`}>
          {ALL.map((s) => (
            <StatusPill key={s} status={s} />
          ))}
        </div>
      ))}
    </div>
  ),
};

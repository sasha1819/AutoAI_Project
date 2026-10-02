import type { Meta, StoryObj } from "@storybook/react-vite";
import { Check, Loader, TriangleAlert, X } from "lucide-react";
import { ToneBadge } from "../_badge/index.ts";
import { Badge } from "./Badge.tsx";

const meta: Meta<typeof Badge> = {
  title: "Primitives/Badge",
  component: Badge,
  args: { label: "Example" },
};
export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};
export const Uppercase: Story = { args: { label: "Area", uppercase: true } };
export const WithIcon: Story = { args: { label: "Example", icon: Check } };

// Never wraps or truncates: a badge is a short word, and the row around it gives it room.
export const LongLabel: Story = {
  args: { label: "A longer area name from a PRD", uppercase: true },
};

// The tones exist only inside StatusPill and SeverityTag (built later); shown here so the look can be reviewed.
export const TonesForStatusPatterns: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ToneBadge label="Neutral" tone="neutral" uppercase />
        <ToneBadge label="Passed" tone="passed" icon={Check} uppercase />
        <ToneBadge label="Failed" tone="failed" icon={X} uppercase />
        <ToneBadge label="Warning" tone="warning" icon={TriangleAlert} uppercase />
        <ToneBadge label="Running" tone="running" icon={Loader} uppercase />
      </div>
      <div className="flex items-center gap-2">
        <ToneBadge label="Low" tone="neutral" />
        <ToneBadge label="Medium" tone="warning" />
        <ToneBadge label="High" tone="failed" />
      </div>
    </div>
  ),
};

// On every surface a badge can sit on.
export const OnSurfaces: Story = {
  render: () => (
    <div className="flex gap-3">
      {(["bg-canvas", "bg-surface", "bg-sunken", "bg-selected"] as const).map((bg) => (
        <div key={bg} className={`rounded-card p-4 ${bg}`}>
          <Badge label="Example" uppercase />
        </div>
      ))}
    </div>
  ),
};

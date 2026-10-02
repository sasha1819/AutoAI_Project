import type { Meta, StoryObj } from "@storybook/react-vite";
import { Settings } from "lucide-react";
import { Button } from "../Button/index.ts";
import { IconButton } from "../IconButton/index.ts";
import { Tooltip, type TooltipSide } from "./Tooltip.tsx";

const meta: Meta<typeof Tooltip> = {
  title: "Primitives/Tooltip",
  component: Tooltip,
  decorators: [
    (Story) => <div className="flex min-h-40 items-center justify-center">{Story()}</div>,
  ],
};
export default meta;
type Story = StoryObj<typeof Tooltip>;

// Open on first render so the look can be reviewed; in the app it opens on hover or keyboard focus.
export const Description: Story = {
  render: () => (
    <Tooltip text="Extra information about this action" purpose="description" defaultOpen>
      <Button variant="secondary">Action</Button>
    </Tooltip>
  ),
};

// As a label: the text repeats the trigger's name for sighted users (how IconButton uses it); not read twice.
export const Label: Story = {
  render: () => (
    <Tooltip text="Settings" purpose="label" defaultOpen>
      <Button variant="secondary">Settings</Button>
    </Tooltip>
  ),
};

// IconButton shows its label itself, also when disabled (hover it: a disabled button cannot take focus).
export const OnIconButtons: Story = {
  render: () => (
    <div className="flex gap-3">
      <IconButton label="Settings" icon={Settings} variant="secondary" />
      <IconButton label="Settings" icon={Settings} variant="secondary" disabled />
    </div>
  ),
};

export const LongTextWraps: Story = {
  render: () => (
    <Tooltip
      text="A longer explanation wraps at a comfortable width instead of running across the screen"
      purpose="description"
      defaultOpen
    >
      <Button variant="secondary">Action</Button>
    </Tooltip>
  ),
};

export const Sides: Story = {
  decorators: [
    (Story) => <div className="flex min-h-64 items-center justify-center">{Story()}</div>,
  ],
  render: () => (
    <div className="grid grid-cols-2 gap-x-40 gap-y-16">
      {(["top", "right", "bottom", "left"] as const satisfies readonly TooltipSide[]).map(
        (side) => (
          <Tooltip key={side} text={`Side ${side}`} purpose="description" side={side} defaultOpen>
            <Button variant="secondary">Action</Button>
          </Tooltip>
        ),
      )}
    </div>
  ),
};

// Closed: hover or tab to the button to open it.
export const Interactive: Story = {
  render: () => (
    <Tooltip text="Extra information about this action" purpose="description">
      <Button variant="secondary">Hover or focus me</Button>
    </Tooltip>
  ),
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "../Button/index.ts";
import { Checkbox } from "../Checkbox/index.ts";
import { IconButton } from "../IconButton/index.ts";
import { Popover } from "./Popover.tsx";

const meta: Meta<typeof Popover> = {
  title: "Primitives/Popover",
  component: Popover,
  decorators: [(Story) => <div className="flex min-h-80 items-start p-4">{Story()}</div>],
};
export default meta;
type Story = StoryObj<typeof Popover>;

const Options = () => (
  <div className="flex flex-col gap-3">
    <p className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Show</p>
    <Checkbox label="First option" defaultChecked />
    <Checkbox label="Second option" />
    <div className="flex justify-end">
      <Button size="sm">Apply</Button>
    </div>
  </div>
);

// Open on first render so the look can be reviewed; in the app the trigger opens it.
export const Open: Story = {
  render: () => (
    <Popover
      label="Example options"
      trigger={<Button variant="secondary">Options</Button>}
      defaultOpen
    >
      {Options()}
    </Popover>
  ),
};
export const Medium: Story = {
  render: () => (
    <Popover
      label="Example details"
      trigger={<Button variant="secondary">Details</Button>}
      width="md"
      defaultOpen
    >
      <p className="text-md text-text-secondary">
        A wider panel for a few lines of detail that would be cramped at the small width.
      </p>
    </Popover>
  ),
};
export const FromIconButton: Story = {
  render: () => (
    <Popover
      label="Example filters"
      trigger={<IconButton label="Filters" icon={SlidersHorizontal} />}
      defaultOpen
    >
      {Options()}
    </Popover>
  ),
};
// Long content scrolls inside the panel (at most 384px tall).
export const LongContent: Story = {
  render: () => (
    <Popover label="Example list" trigger={<Button variant="secondary">Long</Button>} defaultOpen>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 16 }, (_, i) => (
          <Checkbox key={i} label={`Option ${String(i + 1)}`} />
        ))}
      </div>
    </Popover>
  ),
};
// Only text: the panel itself takes focus, shows the ring, and scrolls with the arrow keys.
export const TextOnly: Story = {
  render: () => (
    <Popover
      label="Example details"
      trigger={<Button variant="secondary">Details</Button>}
      width="md"
      defaultOpen
    >
      <p className="text-md text-text-secondary">
        A panel with no controls in it: a few lines of detail about the thing the trigger belongs
        to.
      </p>
    </Popover>
  ),
};
// Opened and closed by the screen's own state.
export const Controlled: Story = {
  render: () => (
    <Popover
      label="Example options"
      trigger={<Button variant="secondary">Options</Button>}
      open
      onOpenChange={() => undefined}
    >
      {Options()}
    </Popover>
  ),
};
// Closed: click or press Enter on the trigger; Escape or a click outside closes it.
export const Interactive: Story = {
  render: () => (
    <Popover label="Example options" trigger={<Button variant="secondary">Options</Button>}>
      {Options()}
    </Popover>
  ),
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircleAlert, FlaskConical, Folder, List, Settings } from "lucide-react";
import { Icon, type IconSize } from "./Icon.tsx";

const meta: Meta<typeof Icon> = {
  title: "Primitives/Icon",
  component: Icon,
  args: { glyph: Folder, decorative: true, size: "md" },
  argTypes: {
    glyph: { control: false },
    size: { control: "inline-radio", options: ["xs", "sm", "md", "lg", "xl"] },
  },
};
export default meta;
type Story = StoryObj<typeof Icon>;

export const Decorative: Story = {};
// Means something with no words beside it: a screen reader hears "Failed, image".
export const Labelled: Story = {
  render: () => <Icon glyph={CircleAlert} label="Failed" size="md" />,
};

const SIZES = [
  ["xs", "12 · tags"],
  ["sm", "14 · sm/md buttons, small fields"],
  ["md", "16 · lg buttons, fields"],
  ["lg", "20 · icon rail"],
  ["xl", "24 · empty-state tile"],
] as const satisfies readonly (readonly [IconSize, string])[];

export const Sizes: Story = {
  render: () => (
    <ul className="flex flex-col gap-3 text-text-secondary">
      {SIZES.map(([size, use]) => (
        <li key={size} className="flex items-center gap-4">
          <span className="flex w-8 justify-center">
            <Icon glyph={Settings} decorative size={size} />
          </span>
          <span className="font-mono text-sm">{size}</span>
          <span className="text-sm text-text-muted">{use}</span>
        </li>
      ))}
    </ul>
  ),
};

// The colour comes from the surrounding text, never from the icon.
export const TakesTextColour: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <span className="inline-flex items-center gap-2 text-sm text-text-primary">
        <Icon glyph={List} decorative size="sm" /> Primary
      </span>
      <span className="inline-flex items-center gap-2 text-sm text-text-secondary">
        <Icon glyph={FlaskConical} decorative size="sm" /> Secondary
      </span>
      <span className="inline-flex items-center gap-2 text-sm text-text-muted">
        <Icon glyph={Folder} decorative size="sm" /> Muted
      </span>
    </div>
  ),
};

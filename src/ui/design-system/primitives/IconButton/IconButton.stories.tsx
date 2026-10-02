import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChevronLeft, Minus, Plus, Send, Settings, X } from "lucide-react";
import { Button, type ButtonVariant } from "../Button/index.ts";
import { IconButton, type IconButtonSize } from "./IconButton.tsx";

const meta: Meta<typeof IconButton> = {
  title: "Primitives/IconButton",
  component: IconButton,
  args: { label: "Close", icon: X, variant: "ghost", size: "md" },
  argTypes: {
    variant: { control: "inline-radio", options: ["ghost", "secondary", "primary"] },
    size: { control: "inline-radio", options: ["sm", "md"] },
    loading: { control: "boolean" },
    disabled: { control: "boolean" },
    icon: { control: false },
    onClick: { action: "click" },
  },
};
export default meta;
type Story = StoryObj<typeof IconButton>;

// Ghost is the default: toolbar and panel icons (close, back, settings).
export const Ghost: Story = {};
export const Secondary: Story = {
  args: { variant: "secondary", label: "Settings", icon: Settings },
};
export const Primary: Story = {
  args: { variant: "primary", size: "sm", label: "Send message", icon: Send },
};

// hover / active / focus-visible cannot be forced in a browser; data-preview-state shows them (theme.css).
export const Hover: Story = {
  render: (args) => <IconButton {...args} data-preview-state="hover" />,
};
export const Pressed: Story = {
  render: (args) => <IconButton {...args} data-preview-state="active" />,
};
export const FocusVisible: Story = {
  render: (args) => <IconButton {...args} data-preview-state="focus-visible" />,
};
export const Disabled: Story = { args: { disabled: true } };
/**
 * A screen reader hears: button, "Send message", busy. The name stays; the spinner is hidden from assistive tech.
 * A change of aria-busy is usually not announced, so a screen that must say "sending…" uses a live region.
 */
export const Loading: Story = {
  args: { variant: "primary", size: "sm", label: "Send message", icon: Send, loading: true },
};

// The same heights as Button, so a toolbar mixes them without jumps.
export const BesideButtons: Story = {
  render: () => (
    <div className="flex items-center gap-2 rounded-card border border-border-subtle bg-surface p-3">
      <IconButton label="Back" icon={ChevronLeft} />
      <Button variant="secondary">Run again</Button>
      <Button>Continue</Button>
      <IconButton label="Zoom out" icon={Minus} />
      <IconButton label="Zoom in" icon={Plus} />
      <IconButton variant="secondary" label="Settings" icon={Settings} />
      <IconButton variant="primary" label="Send message" icon={Send} />
    </div>
  ),
};

// Everything at once, for review against the mockups: every variant in every state, both sizes.
const VARIANTS: readonly ButtonVariant[] = ["ghost", "secondary", "primary"];
const STATES = [
  { label: "default", props: {} },
  { label: "hover", props: { "data-preview-state": "hover" } },
  { label: "pressed", props: { "data-preview-state": "active" } },
  { label: "focus-visible", props: { "data-preview-state": "focus-visible" } },
  { label: "disabled", props: { disabled: true } },
  { label: "loading", props: { loading: true } },
] as const;
const SIZES: readonly IconButtonSize[] = ["sm", "md"];

export const AllStates: Story = {
  render: () => (
    <table className="border-separate border-spacing-x-5 border-spacing-y-3 text-left">
      <thead>
        <tr>
          <th />
          <th />
          {STATES.map((s) => (
            <th
              key={s.label}
              className="text-xs font-semibold uppercase tracking-wide text-text-muted"
            >
              {s.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {VARIANTS.flatMap((variant) =>
          SIZES.map((size) => (
            <tr key={`${variant}-${size}`}>
              <th className="font-mono text-sm font-normal text-text-secondary">{variant}</th>
              <th className="font-mono text-sm font-normal text-text-muted">{size}</th>
              {STATES.map((s) => (
                <td key={s.label}>
                  <IconButton
                    variant={variant}
                    size={size}
                    label="Example action"
                    icon={X}
                    {...s.props}
                  />
                </td>
              ))}
            </tr>
          )),
        )}
      </tbody>
    </table>
  ),
};

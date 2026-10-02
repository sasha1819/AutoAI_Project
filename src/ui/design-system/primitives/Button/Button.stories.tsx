import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRight, ExternalLink, Play } from "lucide-react";
import { Button, type ButtonSize, type ButtonVariant } from "./Button.tsx";

const meta: Meta<typeof Button> = {
  title: "Primitives/Button",
  component: Button,
  args: { children: "Continue", variant: "primary", size: "md" },
  argTypes: {
    variant: { control: "inline-radio", options: ["primary", "secondary", "ghost"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg", "xl"] },
    loading: { control: "boolean" },
    disabled: { control: "boolean" },
    onClick: { action: "click" },
  },
};
export default meta;
type Story = StoryObj<typeof Button>;

// Each state as its own story, per variant.
export const Primary: Story = {};
export const Secondary: Story = { args: { variant: "secondary", children: "Open in editor" } };
export const Ghost: Story = { args: { variant: "ghost", children: "Skip for now" } };

// hover / active / focus-visible cannot be forced in a browser; data-preview-state shows them (theme.css).
export const Hover: Story = { render: (args) => <Button {...args} data-preview-state="hover" /> };
export const Pressed: Story = {
  render: (args) => <Button {...args} data-preview-state="active" />,
};
export const FocusVisible: Story = {
  render: (args) => <Button {...args} data-preview-state="focus-visible" />,
};
export const Disabled: Story = { args: { disabled: true } };
// The spinner takes the icon's place, so a button without an icon grows by one icon width while loading.
export const Loading: Story = { args: { loading: true, children: "Running" } };

export const WithIcons: Story = {
  render: (args) => (
    <div className="flex gap-3">
      <Button {...args} icon={<Play />}>
        Run again
      </Button>
      <Button {...args} trailingIcon={<ArrowRight />}>
        Continue
      </Button>
      <Button {...args} variant="secondary" icon={<ExternalLink />}>
        Open in editor
      </Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Button {...args} size="sm">
        Small · 28
      </Button>
      <Button {...args} size="md">
        Medium · 30
      </Button>
      <Button {...args} size="lg">
        Large · 40
      </Button>
      <Button {...args} size="xl" trailingIcon={<ArrowRight />}>
        Extra large · 44
      </Button>
    </div>
  ),
};

export const FullWidth: Story = {
  render: (args) => (
    <div className="w-72">
      <Button {...args} fullWidth>
        Continue
      </Button>
    </div>
  ),
};

// Everything at once, for review against the mockups: every variant in every state.
const VARIANTS: readonly ButtonVariant[] = ["primary", "secondary", "ghost"];
const STATES = [
  { label: "default", props: {} },
  { label: "hover", props: { "data-preview-state": "hover" } },
  { label: "pressed", props: { "data-preview-state": "active" } },
  { label: "focus-visible", props: { "data-preview-state": "focus-visible" } },
  { label: "disabled", props: { disabled: true } },
  { label: "loading", props: { loading: true } },
] as const;
const SIZES: readonly ButtonSize[] = ["sm", "md", "lg", "xl"];

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <table className="border-separate border-spacing-x-4 border-spacing-y-3 text-left">
        <thead>
          <tr>
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
          {VARIANTS.map((variant) => (
            <tr key={variant}>
              <th className="font-mono text-sm font-normal text-text-secondary">{variant}</th>
              {STATES.map((s) => (
                <td key={s.label}>
                  <Button variant={variant} {...s.props}>
                    Continue
                  </Button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-3">
        {SIZES.map((size) => (
          <Button key={size} size={size} icon={<Play />}>
            Size {size}
          </Button>
        ))}
      </div>
    </div>
  ),
};

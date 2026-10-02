import type { Meta, StoryObj } from "@storybook/react-vite";
import { Switch } from "./Switch.tsx";

const meta: Meta<typeof Switch> = {
  title: "Primitives/Switch",
  component: Switch,
  args: { label: "Example setting" },
  argTypes: {
    disabled: { control: "boolean" },
    hideLabel: { control: "boolean" },
    onCheckedChange: { action: "checkedChange" },
  },
};
export default meta;
type Story = StoryObj<typeof Switch>;

export const Off: Story = {};
export const On: Story = { args: { defaultChecked: true } };
// hover / focus-visible cannot be forced in a browser; Switch spreads no props, so a wrapper carries the hook.
export const Hover: Story = {
  render: (args) => (
    <div data-preview-state="hover">
      <Switch {...args} />
    </div>
  ),
};
export const HoverOn: Story = {
  render: (args) => (
    <div data-preview-state="hover">
      <Switch {...args} defaultChecked />
    </div>
  ),
};
export const FocusVisible: Story = {
  render: (args) => (
    <div data-preview-state="focus-visible">
      <Switch {...args} defaultChecked />
    </div>
  ),
};
export const Disabled: Story = { args: { disabled: true } };
export const DisabledOn: Story = { args: { disabled: true, defaultChecked: true } };
export const HiddenLabel: Story = { args: { hideLabel: true, defaultChecked: true } };
export const WithHint: Story = { args: { hint: "Takes effect immediately." } };
export const Error: Story = {
  args: { error: "Set this up first.", hint: "Takes effect immediately." },
};

// A settings row, the way mockup 8 uses switches: the row's title names it, so the label is visually hidden.
export const InASettingsRow: Story = {
  render: () => (
    <div className="flex w-120 items-center justify-between rounded-card border border-border-subtle bg-surface p-5">
      <div className="flex flex-col">
        <span className="text-md font-semibold text-text-primary">Example setting</span>
        <span className="text-sm text-text-secondary">Applies right away</span>
      </div>
      <Switch label="Example setting" hideLabel defaultChecked />
    </div>
  ),
};

const STATES = [
  { label: "default", props: {}, preview: undefined },
  { label: "hover", props: {}, preview: "hover" },
  { label: "focus-visible", props: {}, preview: "focus-visible" },
  { label: "disabled", props: { disabled: true }, preview: undefined },
  { label: "error", props: { error: "Set this up first." }, preview: undefined },
] as const;

export const AllStates: Story = {
  render: () => (
    <table className="border-separate border-spacing-x-6 border-spacing-y-4 text-left">
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
        {[
          { label: "off", on: false },
          { label: "on", on: true },
        ].map((v) => (
          <tr key={v.label}>
            <th className="align-top font-mono text-sm font-normal text-text-secondary">
              {v.label}
            </th>
            {STATES.map((s) => (
              <td key={s.label} className="align-top" data-preview-state={s.preview}>
                <Switch label="Setting" defaultChecked={v.on} {...s.props} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

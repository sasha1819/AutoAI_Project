import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Checkbox, type CheckboxState } from "./Checkbox.tsx";

const meta: Meta<typeof Checkbox> = {
  title: "Primitives/Checkbox",
  component: Checkbox,
  args: { label: "Example option" },
  argTypes: {
    disabled: { control: "boolean" },
    required: { control: "boolean" },
    hideLabel: { control: "boolean" },
    onCheckedChange: { action: "checkedChange" },
  },
};
export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Unchecked: Story = {};
export const Checked: Story = { args: { defaultChecked: true } };
export const Indeterminate: Story = { args: { defaultChecked: "indeterminate" } };
// hover / focus-visible cannot be forced in a browser; Checkbox spreads no props, so a wrapper carries the
// data-preview-state hook (theme.css).
export const Hover: Story = {
  render: (args) => (
    <div data-preview-state="hover">
      <Checkbox {...args} />
    </div>
  ),
};
export const FocusVisible: Story = {
  render: (args) => (
    <div data-preview-state="focus-visible">
      <Checkbox {...args} defaultChecked />
    </div>
  ),
};
export const Disabled: Story = { args: { disabled: true } };
export const DisabledChecked: Story = { args: { disabled: true, defaultChecked: true } };
export const DisabledMixed: Story = { args: { disabled: true, defaultChecked: "indeterminate" } };
export const HoverChecked: Story = {
  render: (args) => (
    <div data-preview-state="hover">
      <Checkbox {...args} defaultChecked />
    </div>
  ),
};
export const ErrorChecked: Story = {
  args: { defaultChecked: true, error: "Uncheck this to continue." },
};
export const WithHint: Story = { args: { hint: "You can change this later." } };
export const Error: Story = {
  args: {
    required: true,
    error: "This needs to be checked to continue.",
    hint: "You can change this later.",
  },
};
export const HiddenLabel: Story = { args: { label: "Select this row", hideLabel: true } };

// What the mixed state is for: a parent box over a list, mixed while only some are checked.
const ITEMS = ["First item", "Second item", "Third item"] as const;
function SelectAllExample() {
  const [picked, setPicked] = useState<readonly string[]>(["Second item"]);
  const all: CheckboxState =
    picked.length === 0 ? false : picked.length === ITEMS.length ? true : "indeterminate";
  return (
    <div className="flex flex-col gap-2">
      <Checkbox
        label="All items"
        checked={all}
        onCheckedChange={(next) => {
          setPicked(next === true ? [...ITEMS] : []);
        }}
      />
      <div className="flex flex-col gap-2 pl-6">
        {ITEMS.map((item) => (
          <Checkbox
            key={item}
            label={item}
            checked={picked.includes(item)}
            onCheckedChange={(next) => {
              setPicked(next === true ? [...picked, item] : picked.filter((p) => p !== item));
            }}
          />
        ))}
      </div>
    </div>
  );
}
export const SelectAllGroup: Story = { render: () => <SelectAllExample /> };

// Every state at once, for review.
const STATES = [
  { label: "default", props: {}, preview: undefined },
  { label: "hover", props: {}, preview: "hover" },
  { label: "focus-visible", props: {}, preview: "focus-visible" },
  { label: "disabled", props: { disabled: true }, preview: undefined },
  { label: "error", props: { error: "Needs a choice." }, preview: undefined },
  { label: "error + hover", props: { error: "Needs a choice." }, preview: "hover" },
] as const;
const VALUES = [
  { label: "unchecked", value: false },
  { label: "checked", value: true },
  { label: "mixed", value: "indeterminate" },
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
        {VALUES.map((v) => (
          <tr key={v.label}>
            <th className="align-top font-mono text-sm font-normal text-text-secondary">
              {v.label}
            </th>
            {STATES.map((s) => (
              <td key={s.label} className="align-top" data-preview-state={s.preview}>
                <Checkbox label="Option" defaultChecked={v.value} {...s.props} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

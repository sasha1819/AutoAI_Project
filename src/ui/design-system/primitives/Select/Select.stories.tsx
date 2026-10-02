import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../Button/index.ts";
import { Select, type SelectOption, type SelectSize } from "./Select.tsx";

// Generic options: the component knows nothing about any project's data.
const OPTIONS: readonly SelectOption[] = [
  { value: "one", label: "First option" },
  { value: "two", label: "Second option" },
  { value: "three", label: "Third option (unavailable)", disabled: true },
  { value: "four", label: "Fourth option" },
];
const MANY: readonly SelectOption[] = Array.from({ length: 30 }, (_, i) => ({
  value: `item-${String(i + 1)}`,
  label: `Option ${String(i + 1)}`,
}));

const meta: Meta<typeof Select> = {
  title: "Primitives/Select",
  component: Select,
  args: { label: "Example choice", options: OPTIONS, size: "md" },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    disabled: { control: "boolean" },
    hideLabel: { control: "boolean" },
    options: { control: false },
    onValueChange: { action: "valueChange" },
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof Select>;

// Closed states.
export const Default: Story = {};
export const WithValue: Story = { args: { defaultValue: "two" } };
// hover / focus-visible cannot be forced in a browser; Select spreads no props, so the wrapper carries the
// data-preview-state hook (theme.css).
export const Hover: Story = {
  render: (args) => (
    <div data-preview-state="hover">
      <Select {...args} />
    </div>
  ),
};
export const FocusVisible: Story = {
  render: (args) => (
    <div data-preview-state="focus-visible">
      <Select {...args} defaultValue="two" />
    </div>
  ),
};
export const Disabled: Story = { args: { disabled: true, defaultValue: "two" } };
export const WithHint: Story = { args: { hint: "Used until you change it." } };
export const Error: Story = {
  args: { error: "Choose one of the options.", hint: "Used until you change it." },
};
export const Empty: Story = { args: { options: [] } };

// Open states. The mockups never show an open list; it is built from existing tokens (Select.tsx).
export const Open: Story = { args: { defaultOpen: true } };
export const OpenWithSelection: Story = { args: { defaultOpen: true, defaultValue: "two" } };
export const OpenLongList: Story = {
  args: { defaultOpen: true, options: MANY, defaultValue: "item-12" },
};

// A toolbar filter (mockup 6): hug width, label hidden (the value says enough), sm beside a sm Button.
export const ToolbarFilter: Story = {
  decorators: [],
  render: () => (
    <div className="flex items-center gap-2">
      <Select
        label="Time range"
        hideLabel
        width="hug"
        size="sm"
        options={OPTIONS}
        defaultValue="one"
      />
      <Select label="Scope" hideLabel width="hug" size="sm" options={OPTIONS} defaultValue="four" />
      <Button variant="secondary" size="sm">
        Export
      </Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(["sm", "md", "lg"] as const satisfies readonly SelectSize[]).map((size) => (
        <Select
          key={size}
          size={size}
          label={`Size ${size}`}
          options={OPTIONS}
          defaultValue="one"
        />
      ))}
    </div>
  ),
};

// Every closed state at once, for review against the mockups.
const STATES = [
  { label: "default", props: {}, preview: undefined },
  { label: "with value", props: { defaultValue: "two" }, preview: undefined },
  { label: "hover", props: {}, preview: "hover" },
  { label: "focus-visible", props: { defaultValue: "two" }, preview: "focus-visible" },
  { label: "disabled", props: { disabled: true, defaultValue: "two" }, preview: undefined },
  { label: "error", props: { error: "Choose one of the options." }, preview: undefined },
  { label: "empty", props: { options: [] }, preview: undefined },
] as const;

export const AllStates: Story = {
  decorators: [],
  render: () => (
    <div className="flex w-280 flex-wrap gap-x-6 gap-y-5">
      {STATES.map((s) => (
        <div key={s.label} className="w-64" data-preview-state={s.preview}>
          <Select label={s.label} options={OPTIONS} {...s.props} />
        </div>
      ))}
    </div>
  ),
};

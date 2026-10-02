import type { Meta, StoryObj } from "@storybook/react-vite";
import { Folder, Search } from "lucide-react";
import { Input, type InputSize } from "./Input.tsx";

const meta: Meta<typeof Input> = {
  title: "Primitives/Input",
  component: Input,
  args: { label: "Project folder", placeholder: "/path/to/project", size: "md" },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    type: { control: "inline-radio", options: ["text", "search", "email", "url", "password"] },
    disabled: { control: "boolean" },
    readOnly: { control: "boolean" },
    hideLabel: { control: "boolean" },
    icon: { control: false },
    onChange: { action: "change" },
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof Input>;

// Empty, with its placeholder: the resting state.
export const Default: Story = {};
export const Filled: Story = { args: { defaultValue: "/Users/me/projects/example-app" } };

// hover / focus-visible cannot be forced in a browser; data-preview-state shows them (theme.css).
export const Hover: Story = { render: (args) => <Input {...args} data-preview-state="hover" /> };
export const FocusVisible: Story = {
  render: (args) => <Input {...args} data-preview-state="focus-visible" />,
};
export const Disabled: Story = {
  args: { disabled: true, defaultValue: "/Users/me/projects/example-app" },
};
export const ReadOnly: Story = {
  args: { readOnly: true, defaultValue: "/Users/me/projects/example-app" },
};
export const WithHint: Story = {
  args: { hint: "Any folder on this computer. Nothing is uploaded." },
};
export const Error: Story = {
  args: {
    defaultValue: "/missing/folder",
    error: "This folder does not exist.",
    hint: "Any folder on this computer. Nothing is uploaded.",
  },
};
// The red edge and the violet focus ring together: focus stays visible on an invalid field.
export const ErrorFocused: Story = {
  render: (args) => (
    <Input
      {...args}
      defaultValue="/missing/folder"
      error="This folder does not exist."
      data-preview-state="focus-visible"
    />
  ),
};
// A search field with a value: Chromium's own clear button is hidden (the design has none).
export const SearchWithValue: Story = {
  args: {
    label: "Search",
    hideLabel: true,
    type: "search",
    icon: <Search />,
    defaultValue: "example query",
  },
};
export const WithIcon: Story = { args: { size: "lg", icon: <Folder /> } };
export const HiddenLabel: Story = {
  args: {
    label: "Search",
    hideLabel: true,
    type: "search",
    size: "sm",
    icon: <Search />,
    placeholder: "Search…",
  },
};
export const Password: Story = {
  args: { label: "API key", type: "password", defaultValue: "not-a-real-key" },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(["sm", "md", "lg"] as const satisfies readonly InputSize[]).map((size) => (
        <Input
          key={size}
          size={size}
          label={`Size ${size}`}
          placeholder="Placeholder text"
          icon={<Search />}
        />
      ))}
    </div>
  ),
};

// The resting edge is the only cue to where a field is, so it must reach 3:1 on every background it can sit on.
const BACKGROUNDS = [
  { name: "app", className: "bg-app" },
  { name: "canvas", className: "bg-canvas" },
  { name: "surface", className: "bg-surface" },
  { name: "sunken", className: "bg-sunken" },
  { name: "raised", className: "bg-raised" },
  { name: "selected", className: "bg-selected" },
] as const;

export const OnEveryBackground: Story = {
  decorators: [],
  render: () => (
    <div className="grid w-240 grid-cols-3 gap-3">
      {BACKGROUNDS.map((b) => (
        <div key={b.name} className={`rounded-card p-4 ${b.className}`}>
          <Input label={`On ${b.name}`} placeholder="Placeholder text" />
        </div>
      ))}
    </div>
  ),
};

// Every state at once, for review against the mockups.
const STATES = [
  { label: "default", props: {} },
  { label: "filled", props: { defaultValue: "example-value" } },
  { label: "hover", props: { "data-preview-state": "hover" } },
  { label: "focus-visible", props: { "data-preview-state": "focus-visible" } },
  { label: "disabled", props: { disabled: true, defaultValue: "example-value" } },
  { label: "read-only", props: { readOnly: true, defaultValue: "example-value" } },
  {
    label: "error",
    props: { defaultValue: "example-value", error: "Something is wrong with this value." },
  },
] as const;

export const AllStates: Story = {
  decorators: [],
  render: () => (
    <div className="flex w-280 flex-wrap gap-x-6 gap-y-5">
      {STATES.map((s) => (
        <div key={s.label} className="w-64">
          <Input label={s.label} placeholder="Placeholder text" {...s.props} />
        </div>
      ))}
    </div>
  ),
};

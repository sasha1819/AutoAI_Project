import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { type TabItem, Tabs } from "./Tabs.tsx";

const meta: Meta<typeof Tabs> = {
  title: "Primitives/Tabs",
  component: Tabs,
  decorators: [(Story) => <div className="w-160">{Story()}</div>],
};
export default meta;
type Story = StoryObj<typeof Tabs>;

const panel = (text: string) => <p className="pt-4 text-md text-text-secondary">{text}</p>;
const items: readonly TabItem[] = [
  { value: "a", label: "First", content: panel("The first panel.") },
  { value: "b", label: "Second", content: panel("The second panel.") },
  { value: "c", label: "Third", content: panel("The third panel.") },
];

// Section tabs, as mockup 7 (13px, 40 tall, violet underline under the selected tab).
export const Default: Story = { render: () => <Tabs label="Example tabs" items={items} /> };
// Compact panel tabs, as mockup 4's run log (11px caps, 32 tall).
export const Caps: Story = {
  render: () => <Tabs label="Example tabs" items={items} look="caps" />,
};
// A neutral count after the label (the mockup's red count is a status colour, which belongs to StatusPill).
export const WithCount: Story = {
  render: () => (
    <Tabs
      label="Example tabs"
      look="caps"
      items={[
        ...items.slice(0, 2),
        { value: "c", label: "Third", content: panel("Three things."), count: 3 },
      ]}
    />
  ),
};
export const DisabledTab: Story = {
  render: () => (
    <Tabs
      label="Example tabs"
      items={items.map((i) => (i.value === "b" ? { ...i, disabled: true } : i))}
    />
  ),
};
export const SecondSelected: Story = {
  render: () => <Tabs label="Example tabs" items={items} defaultValue="b" />,
};

// States a browser cannot force, previewed on a wrapper (the tabs spread no props).
export const HoverOnInactive: Story = {
  render: () => (
    <div data-preview-state="hover">
      <Tabs label="Example tabs" items={items} />
    </div>
  ),
};
// Real keyboard focus on one tab: the story tabs into the list and moves right (focus follows the selection).
export const KeyboardFocus: Story = {
  render: () => <Tabs label="Example tabs" items={items} />,
  play: async ({ canvasElement }) => {
    const user = userEvent.setup();
    await user.click(canvasElement);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    await expect(within(canvasElement).getByRole("tab", { name: "Second" })).toHaveFocus();
  },
};
// The selected tab has a count: the underline spans the label and the count.
export const CountSelected: Story = {
  render: () => (
    <Tabs
      label="Example tabs"
      look="caps"
      defaultValue="c"
      items={[
        ...items.slice(0, 2),
        { value: "c", label: "Third", content: panel("Three things."), count: 3 },
      ]}
    />
  ),
};

// Many tabs in a narrow area: the row scrolls sideways instead of wrapping.
export const Overflow: Story = {
  decorators: [(Story) => <div className="w-80">{Story()}</div>],
  render: () => (
    <Tabs
      label="Example tabs"
      items={["One", "Two", "Three", "Four", "Five", "Six", "Seven"].map((l) => ({
        value: l.toLowerCase(),
        label: l,
        content: panel(`${l} panel.`),
      }))}
    />
  ),
};

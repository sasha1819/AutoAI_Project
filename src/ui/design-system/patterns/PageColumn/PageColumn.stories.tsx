import type { Meta, StoryObj } from "@storybook/react-vite";
import { PageColumn } from "./PageColumn.tsx";

const meta: Meta<typeof PageColumn> = {
  title: "Patterns/PageColumn",
  component: PageColumn,
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <div className="h-screen bg-canvas">{Story()}</div>],
};
export default meta;
type Story = StoryObj<typeof PageColumn>;

export const Default: Story = {
  render: () => (
    <PageColumn>
      <h1 className="text-xl font-bold text-text-primary">A page title</h1>
      <p className="mt-2 text-md text-text-secondary">
        A sentence that says what this page is for.
      </p>
    </PageColumn>
  ),
};

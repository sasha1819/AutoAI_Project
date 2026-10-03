import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../primitives/Button/index.ts";
import { CenteredPage } from "./CenteredPage.tsx";

const meta: Meta<typeof CenteredPage> = {
  title: "Patterns/CenteredPage",
  component: CenteredPage,
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <div className="h-screen bg-canvas">{Story()}</div>],
};
export default meta;
type Story = StoryObj<typeof CenteredPage>;

const Content = () => (
  <>
    <h1 className="text-xl font-bold text-text-primary">A page title</h1>
    <p className="mt-3 max-w-120 text-md text-text-secondary">
      A sentence that says what this step is for.
    </p>
    <div className="mt-8">
      <Button size="xl">Main action</Button>
    </div>
  </>
);

export const WithFooter: Story = {
  render: () => <CenteredPage footer="A quiet footer line">{Content()}</CenteredPage>,
};
export const WithoutFooter: Story = { render: () => <CenteredPage>{Content()}</CenteredPage> };

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "../../primitives/Card/index.ts";
import { FactList } from "./FactList.tsx";

const meta: Meta<typeof FactList> = { title: "Patterns/FactList", component: FactList };
export default meta;
type Story = StoryObj<typeof FactList>;

// Mockup 7's "Quick facts": a caps heading over a sunken box (placeholder values).
export const QuickFacts: Story = {
  render: () => (
    <div className="flex w-82 flex-col gap-2 bg-surface p-4">
      <h3 className="text-xs font-semibold tracking-wide text-text-secondary uppercase">
        Quick facts
      </h3>
      <Card tone="sunken">
        <FactList
          facts={[
            { label: "Element", value: "#example-id", mono: true },
            { label: "Waited", value: "10.0s" },
            { label: "Retries", value: "3" },
            { label: "Also seen on", value: "Another target" },
          ]}
        />
      </Card>
    </div>
  ),
};
// A long value wraps on the right instead of pushing the label out.
export const LongValue: Story = {
  render: () => (
    <div className="w-72">
      <Card tone="sunken">
        <FactList
          facts={[
            {
              label: "Selector",
              value: "a-very-long-selector-value-that-has-to-wrap-somewhere",
              mono: true,
            },
          ]}
        />
      </Card>
    </div>
  ),
};

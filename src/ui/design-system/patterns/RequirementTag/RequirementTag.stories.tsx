import type { Meta, StoryObj } from "@storybook/react-vite";
import { RequirementTag } from "./RequirementTag.tsx";

const meta: Meta<typeof RequirementTag> = {
  title: "Patterns/RequirementTag",
  component: RequirementTag,
  args: { tag: "Area 1.2" },
};
export default meta;
type Story = StoryObj<typeof RequirementTag>;

export const Default: Story = {};
// A heading-section requirement uses the heading's title as its tag: it truncates in a narrow row.
export const LongTagNarrow: Story = {
  args: { tag: "A long heading title used as a requirement tag" },
  decorators: [(Story) => <div className="flex w-48">{Story()}</div>],
};

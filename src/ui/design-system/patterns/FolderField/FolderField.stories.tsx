import type { Meta, StoryObj } from "@storybook/react-vite";
import { FolderField } from "./FolderField.tsx";

const meta: Meta<typeof FolderField> = {
  title: "Patterns/FolderField",
  component: FolderField,
  args: {
    label: "Project folder",
    placeholder: "No folder chosen",
    chooseLabel: "Choose folder",
    onChoose: () => undefined,
  },
  decorators: [(Story) => <div className="w-215">{Story()}</div>],
};
export default meta;
type Story = StoryObj<typeof FolderField>;

export const Empty: Story = { args: { path: null } };
export const Chosen: Story = { args: { path: "/Users/sam/code/web-app" } };
export const WithHint: Story = {
  args: { path: "/Users/sam/code/web-app", hint: "Your code is read on this computer." },
};
export const Busy: Story = { args: { path: null, busy: true } };
export const BusyWithPath: Story = {
  args: { path: "/Users/sam/code/web-app", chooseLabel: "Change folder", busy: true },
};
export const Error: Story = {
  args: {
    path: "/Users/sam/code/web-app/docs",
    chooseLabel: "Change folder",
    hint: "Markdown or text files.",
    error: "AutoAI isn't allowed to read some files in this folder.",
  },
};
export const LongPath: Story = {
  args: {
    path: "/Users/sam/Documents/clients/a-very-long-client-name/projects/2026/the-web-app/packages/frontend/app",
  },
};

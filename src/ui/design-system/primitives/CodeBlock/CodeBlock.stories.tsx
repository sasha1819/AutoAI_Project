import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { CodeBlock } from "./CodeBlock.tsx";

const meta: Meta<typeof CodeBlock> = {
  title: "Primitives/CodeBlock",
  component: CodeBlock,
  decorators: [(Story) => <div className="w-160">{Story()}</div>],
};
export default meta;
type Story = StoryObj<typeof CodeBlock>;

const short = `import { test, expect } from "@playwright/test";

test("example", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading")).toBeVisible();
});`;

export const Default: Story = { args: { label: "Example code", code: short } };
export const NoLineNumbers: Story = {
  args: { label: "Example code", code: short, lineNumbers: false },
};
export const NotCopyable: Story = { args: { label: "Example code", code: short, copyable: false } };
// A long line scrolls sideways; the line numbers stay put. The area is focusable, so the keyboard can scroll it.
export const LongLine: Story = {
  args: {
    label: "Example code",
    code: `const value = "${"a long string that keeps going ".repeat(8)}";\nconst next = 1;`,
  },
};
// At most 384px tall, then it scrolls.
export const LongFile: Story = {
  args: {
    label: "Example code",
    height: "scroll",
    code: Array.from(
      { length: 60 },
      (_, i) => "const value_" + String(i + 1) + " = " + String(i + 1) + ";",
    ).join("\n"),
  },
};
export const FocusVisible: Story = {
  render: () => (
    <div data-preview-state="focus-visible">
      <CodeBlock label="Example code" code={short} copyable={false} />
    </div>
  ),
};

// After a copy: the button says "Copied" (and so does the announcer).
export const Copied: Story = {
  args: { label: "Example code", code: short },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Copy code" }));
    await expect(await canvas.findByRole("button", { name: "Copied" })).toBeTruthy();
  },
};

// The clipboard refused: the button says "Copy failed" (and so does the announcer).
export const CopyFailed: Story = {
  args: { label: "Example code", code: short },
  play: async ({ canvasElement }) => {
    const write = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = () => Promise.reject(new Error("denied"));
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Copy code" }));
    await expect(await canvas.findByRole("button", { name: "Copy failed" })).toBeTruthy();
    navigator.clipboard.writeText = write;
  },
};

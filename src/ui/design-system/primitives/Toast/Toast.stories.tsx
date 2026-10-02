import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../Button/index.ts";
import { Toast } from "./Toast.tsx";
import { ToastProvider, useToast } from "./ToastProvider.tsx";

const meta: Meta<typeof Toast> = {
  title: "Primitives/Toast",
  component: Toast,
  args: { title: "Something finished", kind: "info", onDismiss: () => undefined },
};
export default meta;
type Story = StoryObj<typeof Toast>;

// The card alone. In the app a screen never renders it: it calls useToast().show.
export const Info: Story = {};
export const InfoWithDescription: Story = {
  args: { description: "A second line with more detail about it" },
};
// Told apart by its icon and by "Error:" in what is read out: status colours are not used here (ARCHITECTURE §7).
export const ErrorToast: Story = {
  args: { title: "Something failed", kind: "error", description: "What to try next" },
};
export const LongText: Story = {
  args: {
    title: "A longer title that needs to wrap onto a second line",
    description:
      "A longer description wraps inside the fixed card width and the dismiss button stays at the top",
  },
};
export const DismissHover: Story = {
  render: (args) => (
    <div data-preview-state="hover">
      <Toast {...args} />
    </div>
  ),
};
// Several at once, as they stack in the corner (newest last).
export const Stack: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Toast title="Something finished" kind="info" onDismiss={() => undefined} />
      <Toast
        title="Something failed"
        description="What to try next"
        kind="error"
        onDismiss={() => undefined}
      />
      <Toast
        title="A longer title that needs to wrap onto a second line"
        description="And a description under it"
        kind="info"
        onDismiss={() => undefined}
      />
    </div>
  ),
};
export const DismissFocused: Story = {
  render: (args) => (
    <div data-preview-state="focus-visible">
      <Toast {...args} />
    </div>
  ),
};

function Demo() {
  const toast = useToast();
  return (
    <div className="flex gap-3">
      <Button
        variant="secondary"
        onClick={() => toast.show({ title: "Something finished", description: "Closes by itself" })}
      >
        Show info
      </Button>
      <Button
        variant="secondary"
        onClick={() => toast.show({ title: "Something failed", kind: "error" })}
      >
        Show error
      </Button>
    </div>
  );
}

// The real flow: info closes after a few seconds (not while hovered or focused); an error stays until dismissed.
// F6 moves focus to the newest toast, Escape dismisses it.
export const Interactive: Story = {
  render: () => (
    <ToastProvider>
      <Demo />
    </ToastProvider>
  ),
};

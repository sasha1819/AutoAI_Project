import type { Meta, StoryObj } from "@storybook/react-vite";
import { Spinner, type SpinnerSize } from "./Spinner.tsx";

const meta: Meta<typeof Spinner> = { title: "Primitives/Spinner", component: Spinner };
export default meta;
type Story = StoryObj<typeof Spinner>;

export const WithLabel: Story = { args: { label: "Loading results" } };
export const Decorative: Story = { args: { decorative: true } };

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-6 text-text-secondary">
      {(["sm", "md", "lg"] as const satisfies readonly SpinnerSize[]).map((size) => (
        <div key={size} className="flex items-center gap-2">
          <Spinner label={`Loading, ${size}`} size={size} />
          <span className="font-mono text-sm">{size}</span>
        </div>
      ))}
    </div>
  ),
};

// It takes the colour of the text around it.
export const InheritsColour: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <span className="flex items-center gap-2 text-text-primary">
        <Spinner decorative /> Primary text
      </span>
      <span className="flex items-center gap-2 text-text-muted">
        <Spinner decorative /> Muted text
      </span>
    </div>
  ),
};

// The empty-area use: a short message next to the spinner, which is still the one status.
export const LoadingArea: Story = {
  render: () => (
    <div className="flex h-40 w-96 flex-col items-center justify-center gap-3 rounded-card border border-border-subtle bg-surface text-text-secondary">
      <Spinner label="Loading the list" size="lg" />
      {/* The same words for eyes and ears; the status already says them, so this copy is hidden from assistive tech. */}
      <span aria-hidden="true" className="text-sm">
        Loading the list
      </span>
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileText, List, Plus } from "lucide-react";
import { Button } from "../Button/index.ts";
import { Card } from "../Card/index.ts";
import { Input } from "../Input/index.ts";
import { EmptyState } from "./EmptyState.tsx";

const meta: Meta<typeof EmptyState> = {
  title: "Primitives/EmptyState",
  component: EmptyState,
  decorators: [
    (Story) => (
      <div className="flex min-h-96 w-200 items-center justify-center bg-canvas p-8">{Story()}</div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof EmptyState>;

export const TitleOnly: Story = { args: { title: "Nothing here yet" } };
export const WithIconAndDescription: Story = {
  args: {
    title: "Nothing here yet",
    description:
      "A sentence or two that says how to get started, wrapping at a readable width when it is long.",
    icon: List,
  },
};

// The shape of mockup 9: a field with an action, then suggestions as cards. Content is placeholder only.
export const WithActions: Story = {
  render: () => (
    <EmptyState
      title="Nothing here yet"
      description="Say how to start, then offer the first steps below."
      icon={FileText}
      actions={
        <>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Input label="Describe it" hideLabel size="lg" placeholder="Placeholder text" />
            </div>
            <Button size="xl">Create</Button>
          </div>
          <ul className="flex flex-col gap-2 text-left">
            {["First suggestion", "Second suggestion"].map((s) => (
              <Card key={s} as="li" size="sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-md text-text-primary">{s}</span>
                  <Button variant="secondary" size="sm" icon={Plus}>
                    Add
                  </Button>
                </div>
              </Card>
            ))}
          </ul>
        </>
      }
    />
  ),
};

export const LongText: Story = {
  args: {
    title: "A much longer title that has to wrap onto a second line in a narrow area",
    description:
      "A long description keeps a readable measure: it wraps at 480px and stays centred under the title, however much there is to say about how to begin.",
    icon: List,
  },
};

// Inside a section that already has an h2, the empty state's title is an h3 (same look).
export const HeadingLevel3: Story = {
  args: { title: "Nothing here yet", headingLevel: 3, icon: List },
};

// One muted line inside a panel or list (mockup 9 sidebar).
export const Compact: Story = {
  decorators: [(Story) => <div className="flex h-60 w-70 items-center bg-surface">{Story()}</div>],
  args: { size: "compact", title: "Nothing here yet — your first item will show up in this list." },
};

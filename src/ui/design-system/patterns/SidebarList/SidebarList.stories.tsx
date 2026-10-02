import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { RequirementTag } from "../RequirementTag/index.ts";
import { StatusDot, statusWord } from "../StatusPill/index.ts";
import { StepRow } from "../StepRow/index.ts";
import { type SidebarItem, SidebarList } from "./SidebarList.tsx";

const meta: Meta = { title: "Patterns/SidebarList" };
export default meta;
type Story = StoryObj;

function Steps({ start }: { readonly start?: string }) {
  const [selected, setSelected] = useState<string | undefined>(start);
  const items: readonly SidebarItem[] = [
    { id: "1", content: <StepRow name="First step" status="passed" durationMs={1200} /> },
    { id: "2", content: <StepRow name="Second step" status="passed" durationMs={3400} /> },
    { id: "3", content: <StepRow name="Third step" status="failed" durationMs={10_000} /> },
    { id: "4", content: <StepRow name="Fourth step" status="not_run" /> },
  ];
  return (
    <div className="w-60 bg-surface py-2">
      <SidebarList
        label="Steps"
        showLabel
        items={items}
        selectedId={selected}
        onSelect={setSelected}
        emptyText="No steps yet"
      />
    </div>
  );
}
// Mockup 7's step list: the failed step selected (neutral selection; the status stays in the icon).
export const StepList: Story = { render: () => <Steps start="3" /> };
export const NothingSelected: Story = { render: () => <Steps /> };

const TestRow = ({
  name,
  tag,
  status,
}: {
  readonly name: string;
  readonly tag: string;
  readonly status: "passed" | "failed" | "running";
}) => (
  <span className="flex min-h-10 min-w-0 flex-1 items-center gap-3">
    <StatusDot status={status} />
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-md text-text-primary">
        {name}
        <span className="sr-only">, {statusWord(status).toLowerCase()}, </span>
      </span>
      <RequirementTag tag={tag} />
    </span>
  </span>
);
function Tests() {
  const [selected, setSelected] = useState<string | undefined>("2");
  const items: readonly SidebarItem[] = [
    { id: "1", content: <TestRow name="First test" tag="Area 1.2" status="passed" /> },
    { id: "2", content: <TestRow name="Second test" tag="Area 2.1" status="running" /> },
    { id: "3", content: <TestRow name="Third test" tag="Area 3.3" status="failed" /> },
  ];
  return (
    <div className="w-70 bg-surface py-2">
      <SidebarList
        label="Test cases"
        showLabel
        items={items}
        selectedId={selected}
        onSelect={setSelected}
        emptyText="No test cases yet"
      />
    </div>
  );
}
// Mockup 4's test list: two-line rows with a status dot.
export const TestList: Story = { render: () => <Tests /> };

export const Empty: Story = {
  render: () => (
    <div className="w-70 bg-surface py-2">
      <SidebarList
        label="Test cases"
        showLabel
        items={[]}
        selectedId={undefined}
        onSelect={() => undefined}
        emptyText="Nothing here yet — your first item will show up in this list."
      />
    </div>
  ),
};

export const WithDisabledRow: Story = {
  render: () => (
    <div className="w-60 bg-surface py-2">
      <SidebarList
        label="Example list"
        showLabel
        items={[
          { id: "a", content: <StepRow name="Available" status="passed" durationMs={800} /> },
          { id: "b", content: <StepRow name="Unavailable" status="not_run" />, disabled: true },
        ]}
        selectedId="a"
        onSelect={() => undefined}
        emptyText="None"
      />
    </div>
  ),
};

// Hover and keyboard focus on a row (previewed; the list spreads no props).
export const RowStates: Story = {
  render: () => (
    <div className="flex gap-4">
      <div data-preview-state="hover">
        <Steps />
      </div>
      <div data-preview-state="focus-visible">
        <Steps start="2" />
      </div>
    </div>
  ),
};

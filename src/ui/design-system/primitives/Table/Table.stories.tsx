import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircleCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Icon } from "../Icon/index.ts";
import { Card } from "../Card/index.ts";
import { Table, type TableColumn } from "./Table.tsx";

const meta: Meta = { title: "Primitives/Table" };
export default meta;
type Story = StoryObj;

type Row = {
  readonly id: string;
  readonly at: string;
  readonly what: string;
  readonly took: string;
};
const rows: readonly Row[] = [
  { id: "1", at: "00:00.0", what: "First step of the example", took: "1.2s" },
  { id: "2", at: "00:01.2", what: "Second step of the example", took: "3.4s" },
  {
    id: "3",
    at: "00:04.6",
    what: "Third step, whose description is long enough to wrap onto a second line inside its column",
    took: "0.8s",
  },
];
const columns: readonly TableColumn<Row>[] = [
  { key: "at", header: "Time", cell: (r) => r.at, mono: true, muted: true, width: "sm" },
  { key: "what", header: "Step", cell: (r) => r.what, rowHeader: true },
  { key: "took", header: "Duration", cell: (r) => r.took, align: "end", mono: true, width: "sm" },
];
const base = {
  caption: "Example steps",
  columns,
  rows,
  rowKey: (r: Row) => r.id,
  emptyText: "Nothing here yet",
} as const;

const Frame = ({ children }: { readonly children: ReactNode }) => (
  <div className="w-160">
    <Card>{children}</Card>
  </div>
);

export const Default: Story = {
  render: () => (
    <Frame>
      <Table {...base} />
    </Frame>
  ),
};
// 26px rows (the run log's row spacing in mockup 4).
export const Compact: Story = {
  render: () => (
    <Frame>
      <Table {...base} density="sm" />
    </Frame>
  ),
};
// The screen already has a heading for it: the caption still names the table for screen readers.
export const HiddenCaption: Story = {
  render: () => (
    <Frame>
      <Table {...base} hideCaption />
    </Frame>
  ),
};
export const Empty: Story = {
  render: () => (
    <Frame>
      <Table {...base} rows={[]} />
    </Frame>
  ),
};
export const Loading: Story = {
  render: () => (
    <Frame>
      <Table {...base} loading />
    </Frame>
  ),
};
// Narrow: fixed layout, text wraps inside its column; the table never scrolls sideways.
export const Narrow: Story = {
  render: () => (
    <div className="w-80">
      <Card>
        <Table {...base} />
      </Card>
    </div>
  ),
};

// A column that speaks for itself (an icon): its header is read by screen readers but not shown.
export const HiddenHeaderColumn: Story = {
  render: () => (
    <Frame>
      <Table
        {...base}
        columns={[
          {
            key: "ok",
            header: "Result",
            hideHeader: true,
            width: "xs",
            cell: () => <Icon glyph={CircleCheck} label="Done" size="sm" />,
          },
          ...columns,
        ]}
      />
    </Frame>
  ),
};

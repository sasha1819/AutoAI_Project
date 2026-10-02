import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Table, type TableColumn } from "./Table.tsx";

type Row = { readonly id: string; readonly name: string; readonly took: string };
const rows: readonly Row[] = [
  { id: "a", name: "First step", took: "1.2s" },
  { id: "b", name: "Second step", took: "3.4s" },
];
const columns: readonly TableColumn<Row>[] = [
  { key: "name", header: "Step", cell: (r) => r.name, rowHeader: true },
  { key: "took", header: "Duration", cell: (r) => r.took, align: "end", mono: true, width: "sm" },
];
const base = {
  caption: "Steps",
  columns,
  rows,
  rowKey: (r: Row) => r.id,
  emptyText: "No steps yet",
} as const;

describe("Table", () => {
  it("is a table named by its caption, with column headers and a row-header column", () => {
    render(<Table {...base} />);
    const table = screen.getByRole("table", { name: "Steps" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["Step", "Duration"]);
    expect(within(table).getByRole("rowheader", { name: "First step" }).getAttribute("scope")).toBe(
      "row",
    );
    expect(
      within(table)
        .getAllByRole("cell")
        .map((c) => c.textContent),
    ).toEqual(["1.2s", "3.4s"]);
  });

  it("end-aligned mono columns, and fixed widths", () => {
    render(<Table {...base} />);
    const cell = screen.getByRole("cell", { name: "1.2s" });
    expect(cell.className).toContain("text-right");
    expect(cell.className).toContain("font-mono");
    expect(screen.getByRole("columnheader", { name: "Duration" }).className).toContain("w-24");
  });

  it("a hidden caption or header still names the table and column", () => {
    render(
      <Table
        {...base}
        hideCaption
        columns={[
          {
            ...columns[0],
            key: "s",
            header: "Status",
            hideHeader: true,
            cell: () => "ok",
            rowHeader: false,
          },
        ]}
      />,
    );
    expect(screen.getByRole("table", { name: "Steps" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeTruthy();
  });

  it.each([
    ["md", "h-9", "py-1.5"],
    ["sm", "h-6.5", "py-0.5"],
  ] as const)("density %s: rows %s, with cell padding that fits (%s)", (density, height, pad) => {
    render(<Table {...base} density={density} />);
    const cell = screen.getByRole("cell", { name: "1.2s" });
    expect(cell.parentElement?.className).toContain(height);
    expect(cell.className).toContain(pad);
  });

  it("a muted column uses secondary text; the row header looks like any cell", () => {
    render(
      <Table
        {...base}
        columns={[
          { key: "name", header: "Step", cell: (r: Row) => r.name, rowHeader: true, muted: true },
        ]}
      />,
    );
    const header = screen.getByRole("rowheader", { name: "First step" });
    expect(header.className).toContain("text-text-secondary");
    expect(header.className).toContain("font-normal");
  });

  it("loading wins over empty", () => {
    render(<Table {...base} rows={[]} loading />);
    expect(screen.queryByText("No steps yet")).toBeNull();
  });

  it("says when it is empty, across all columns", () => {
    render(<Table {...base} rows={[]} />);
    const cell = screen.getByRole("cell", { name: "No steps yet" });
    expect(cell.getAttribute("colspan")).toBe("2");
  });

  it("loading: marked busy, with a named loading status instead of rows", () => {
    render(<Table {...base} loading />);
    expect(screen.getByRole("table").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status", { name: "Loading rows" })).toBeTruthy();
    expect(screen.queryByText("First step")).toBeNull();
  });

  it.each([
    ["no columns", { columns: [] }, /at least one column/],
    [
      "a blank header",
      { columns: [{ key: "a", header: " ", cell: () => null }] },
      /non-blank key and header/,
    ],
    [
      "a repeated column key",
      {
        columns: [
          { key: "a", header: "A", cell: () => null },
          { key: "a", header: "B", cell: () => null },
        ],
      },
      /used twice/,
    ],
    [
      "a repeated header",
      {
        columns: [
          { key: "a", header: "Name", cell: () => null },
          { key: "b", header: "name ", cell: () => null },
        ],
      },
      /used twice/,
    ],
    [
      "two row headers",
      {
        columns: [
          { key: "a", header: "A", cell: () => null, rowHeader: true },
          { key: "b", header: "B", cell: () => null, rowHeader: true },
        ],
      },
      /at most one/,
    ],
    ["two rows with one key", { rowKey: () => "same" }, /same key/],
    ["a blank row key", { rowKey: () => " " }, /non-blank key/],
    ["a blank empty text", { emptyText: " " }, /empty text/],
  ])("refuses %s", (_name, override, message) => {
    expect(() => render(<Table {...base} {...override} />)).toThrow(message);
  });

  // The ts-expect-error lines are checked at typecheck time (part of verify); a blank caption also throws at runtime.
  it("must be named and say when it is empty; closed props", () => {
    const blank: string = " ";
    expect(() => render(<Table {...base} caption={blank} />)).toThrow(
      "Table needs a non-empty label",
    );
    expect(() =>
      // @ts-expect-error a table without a caption
      render(<Table columns={columns} rows={rows} rowKey={(r: Row) => r.id} emptyText="None" />),
    ).toThrow(/label/);
    expect(() =>
      // @ts-expect-error an empty table that says nothing (and throws at runtime)
      render(<Table caption="X" columns={columns} rows={rows} rowKey={(r: Row) => r.id} />),
    ).toThrow(/empty text/);
    // @ts-expect-error closed props: no className
    render(<Table {...base} caption="Y" className="x" />);
    expect(screen.getAllByRole("table").length).toBeGreaterThan(0);
  });
});

import type { ReactNode } from "react";
import {
  assertAccessibleName,
  isBlank,
  nameKey,
  type NonEmpty,
} from "../../accessibility/accessible-name.ts";
import { Spinner } from "../Spinner/index.ts";

/** fill (default): shares the space left · xs 64 · sm 96 · md 160 · lg 256 (fixed layout: text wraps inside). */
export type ColumnWidth = "fill" | "xs" | "sm" | "md" | "lg";

export type TableColumn<Row> = {
  /** Unique within the table. */
  readonly key: string;
  /** The column header: non-blank, since screen readers announce it with every cell. */
  readonly header: string;
  /** Shown visually too, unless the column speaks for itself (an icon or status column): then sr-only. */
  readonly hideHeader?: boolean;
  readonly cell: (row: Row) => ReactNode;
  /** end: numbers, durations, counts. */
  readonly align?: "start" | "end";
  /** Ids, timings, file paths (mockup 4 run log, 7 quick facts). */
  readonly mono?: boolean;
  /** Secondary text (timestamps, metadata). */
  readonly muted?: boolean;
  readonly width?: ColumnWidth;
  /** This column names each row (a th with scope=row): at most one column. */
  readonly rowHeader?: boolean;
};

/**
 * md 36px rows (data tables) · sm 26px rows (measured: mockup 4 run log). In sm, cell content must be at most 20px
 * tall (a text line, an Icon up to md); taller content (a control, a pill) makes the row grow.
 */
export type TableDensity = "md" | "sm";

export type TableProps<Row, Caption extends string = string, EmptyText extends string = string> = {
  /** Names the table. Shown above it unless the screen already has a heading for it (hideCaption). */
  readonly caption: NonEmpty<Caption>;
  readonly hideCaption?: boolean;
  readonly columns: readonly TableColumn<Row>[];
  readonly rows: readonly Row[];
  /** A stable, unique key per row. */
  readonly rowKey: (row: Row) => string;
  /** Said in place of rows when there are none ("No runs yet"). Required: an empty table must say so. */
  readonly emptyText: NonEmpty<EmptyText>;
  /**
   * Rows are on their way: a labelled spinner replaces them and the table is marked busy. A status that appears
   * already filled is not announced by every screen reader: a screen that must say "loading runs" says it in a live
   * region that is already on the page (the Toast announcer), not only here.
   */
  readonly loading?: boolean;
  readonly density?: TableDensity;
};

const WIDTH: Record<ColumnWidth, string> = {
  fill: "",
  xs: "w-16",
  sm: "w-24",
  md: "w-40",
  lg: "w-64",
};
const ROW_HEIGHT: Record<TableDensity, string> = { md: "h-9", sm: "h-6.5" };
// A row is at least its cells' padding plus a 20px line: the padding must fit inside the row height.
const CELL_PAD_Y: Record<TableDensity, string> = { md: "py-1.5", sm: "py-0.5" };

function checkColumns(columns: readonly TableColumn<never>[]): void {
  if (columns.length === 0) throw new Error("Table needs at least one column");
  const keys = new Set<string>();
  const headers = new Set<string>();
  for (const c of columns) {
    if (isBlank(c.key) || isBlank(c.header))
      throw new Error("Table: every column needs a non-blank key and header");
    if (keys.has(c.key)) throw new Error(`Table: the column key "${c.key}" is used twice`);
    if (headers.has(nameKey(c.header)))
      throw new Error(`Table: the header "${c.header}" is used twice`);
    keys.add(c.key);
    headers.add(nameKey(c.header));
  }
  if (columns.filter((c) => c.rowHeader === true).length > 1)
    throw new Error("Table: at most one row-header column");
}

/**
 * A data table: real table semantics (caption, column headers, an optional row-header column), so screen readers
 * announce each cell with its headers. It always has a header row: a list without one (the run log, mockup 4) or
 * label/value pairs (Quick facts, mockup 7) are other patterns. Fixed layout: text wraps inside its column, so the table never scrolls
 * sideways. Rows are not interactive; a clickable row is a pattern built on top. A closed set of props.
 */
export function Table<Row, Caption extends string, EmptyText extends string>({
  caption,
  hideCaption = false,
  columns,
  rows,
  rowKey,
  emptyText,
  loading = false,
  density = "md",
}: TableProps<Row, Caption, EmptyText>) {
  assertAccessibleName(caption, "Table");
  assertAccessibleName(emptyText, "Table empty text");
  checkColumns(columns);
  const keys = rows.map(rowKey);
  if (keys.some(isBlank)) throw new Error("Table: every row needs a non-blank key");
  if (new Set(keys).size !== keys.length) throw new Error("Table: two rows have the same key");
  const cellBase = (c: TableColumn<Row>) =>
    `px-3 ${CELL_PAD_Y[density]} align-middle break-words ${c.align === "end" ? "text-right" : "text-left"} ` +
    `${c.mono === true ? "font-mono text-sm" : "text-md"} ${c.muted === true ? "text-text-secondary" : "text-text-primary"}`;
  return (
    <table aria-busy={loading || undefined} className="w-full table-fixed border-collapse">
      <caption
        className={
          hideCaption ? "sr-only" : "pb-2 text-left text-sm font-semibold text-text-secondary"
        }
      >
        {caption}
      </caption>
      <thead>
        <tr className="border-b border-border-default">
          {columns.map((c) => (
            <th
              key={c.key}
              scope="col"
              className={`h-8 px-3 text-xs font-semibold tracking-wide text-text-secondary uppercase ${WIDTH[c.width ?? "fill"]} ${c.align === "end" ? "text-right" : "text-left"}`}
            >
              {c.hideHeader === true ? <span className="sr-only">{c.header}</span> : c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan={columns.length} className="h-16 text-center">
              <span className="inline-flex text-text-secondary">
                <Spinner label="Loading rows" />
              </span>
            </td>
          </tr>
        ) : rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="h-16 px-3 text-center text-sm text-text-muted">
              {emptyText}
            </td>
          </tr>
        ) : (
          rows.map((row, i) => (
            <tr
              key={keys[i]}
              className={`border-b border-border-subtle last:border-b-0 ${ROW_HEIGHT[density]}`}
            >
              {columns.map((c) =>
                c.rowHeader === true ? (
                  <th key={c.key} scope="row" className={`font-normal ${cellBase(c)}`}>
                    {c.cell(row)}
                  </th>
                ) : (
                  <td key={c.key} className={cellBase(c)}>
                    {c.cell(row)}
                  </td>
                ),
              )}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { type SidebarItem, SidebarList } from "./SidebarList.tsx";

type Id = "a" | "b" | "c" | "d";
const items: readonly SidebarItem<Id>[] = [
  { id: "a", content: "First" },
  { id: "b", content: "Second" },
  { id: "c", content: "Third", disabled: true },
  { id: "d", content: "Fourth" },
];

function Controlled({
  start,
  onSelect,
}: {
  readonly start?: Id;
  readonly onSelect?: (id: Id) => void;
}) {
  const [selected, setSelected] = useState<Id | undefined>(start);
  return (
    <>
      <button type="button">Before</button>
      <SidebarList
        label="Example list"
        items={items}
        selectedId={selected}
        onSelect={(id) => {
          setSelected(id);
          onSelect?.(id);
        }}
        emptyText="Nothing yet"
      />
      <button type="button">After</button>
    </>
  );
}

describe("SidebarList", () => {
  it("is a named listbox whose options say whether they are selected", () => {
    render(<Controlled start="b" />);
    expect(screen.getByRole("listbox", { name: "Example list" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Second" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByRole("option", { name: "First" }).getAttribute("aria-selected")).toBe(
      "false",
    );
    expect(screen.getByRole("option", { name: "Third" }).getAttribute("aria-disabled")).toBe(
      "true",
    );
  });

  it("one Tab stop: the selected row (or the first enabled one); Tab moves on past the list", async () => {
    const user = userEvent.setup();
    render(<Controlled start="b" />);
    await user.click(screen.getByRole("button", { name: "Before" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("option", { name: "Second" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
  });

  it("arrows move and select, skipping disabled rows; Home and End jump", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn<(id: Id) => void>();
    render(<Controlled onSelect={onSelect} />);
    await user.click(screen.getByRole("button", { name: "Before" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("option", { name: "First" }));
    await user.keyboard("{ArrowDown}");
    expect(onSelect).toHaveBeenLastCalledWith("b");
    await user.keyboard("{ArrowDown}");
    expect(onSelect).toHaveBeenLastCalledWith("d");
    expect(document.activeElement).toBe(screen.getByRole("option", { name: "Fourth" }));
    expect(screen.getByRole("option", { name: "Fourth" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    await user.keyboard("{Home}");
    expect(onSelect).toHaveBeenLastCalledWith("a");
    await user.keyboard("{End}");
    expect(onSelect).toHaveBeenLastCalledWith("d");
  });

  it("a click selects; a disabled row ignores it", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn<(id: Id) => void>();
    render(<Controlled onSelect={onSelect} />);
    await user.click(screen.getByRole("option", { name: "Second" }));
    expect(onSelect).toHaveBeenLastCalledWith("b");
    await user.click(screen.getByRole("option", { name: "Third" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("a click on a disabled row does not take focus, so the keys keep working", async () => {
    const user = userEvent.setup();
    render(<Controlled start="b" />);
    await user.click(screen.getByRole("option", { name: "Second" }));
    await user.click(screen.getByRole("option", { name: "Third" }));
    expect(document.activeElement).toBe(screen.getByRole("option", { name: "Second" }));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("option", { name: "Fourth" }));
  });

  it("the heading level fits the outline", () => {
    render(
      <SidebarList
        label="Steps"
        showLabel
        headingLevel={3}
        items={items}
        selectedId={undefined}
        onSelect={vi.fn()}
        emptyText="None"
      />,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Steps" })).toBeTruthy();
  });

  it("a visible label is a heading that names the list", () => {
    render(
      <SidebarList
        label="Steps"
        showLabel
        items={items}
        selectedId={undefined}
        onSelect={vi.fn()}
        emptyText="None"
      />,
    );
    expect(screen.getByRole("heading", { name: "Steps" })).toBeTruthy();
    expect(screen.getByRole("listbox", { name: "Steps" })).toBeTruthy();
  });

  it("a hidden label adds no heading", () => {
    render(
      <SidebarList
        label="Steps"
        items={items}
        selectedId={undefined}
        onSelect={vi.fn()}
        emptyText="None"
      />,
    );
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("says when it is empty, with no empty listbox", () => {
    render(
      <SidebarList
        label="Steps"
        items={[]}
        selectedId={undefined}
        onSelect={vi.fn()}
        emptyText="Nothing yet"
      />,
    );
    expect(screen.getByText("Nothing yet")).toBeTruthy();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it.each([
    [
      "a repeated id",
      [
        { id: "a", content: "A" },
        { id: "a", content: "B" },
      ],
      undefined,
      /same id/,
    ],
    ["a blank id", [{ id: " ", content: "A" }], undefined, /non-blank id/],
    ["a selected id that is not a row", [{ id: "a", content: "A" }], "zz", /not a row/],
    [
      "only disabled rows (it could not be reached)",
      [{ id: "a", content: "A", disabled: true }],
      undefined,
      /at least one row must be enabled/,
    ],
  ])("refuses %s", (_name, bad, selected, message) => {
    expect(() =>
      render(
        <SidebarList
          label="L"
          items={bad}
          selectedId={selected}
          onSelect={vi.fn()}
          emptyText="None"
        />,
      ),
    ).toThrow(message);
  });

  // The ts-expect-error lines are checked at typecheck time (part of verify); blank names also throw at runtime.
  it("must be named and say when empty; closed props", () => {
    const blank: string = " ";
    expect(() =>
      render(
        <SidebarList
          label={blank}
          items={items}
          selectedId={undefined}
          onSelect={vi.fn()}
          emptyText="x"
        />,
      ),
    ).toThrow("SidebarList needs a non-empty label");
    expect(() =>
      // @ts-expect-error a list that says nothing when empty
      render(<SidebarList label="L" items={items} selectedId={undefined} onSelect={vi.fn()} />),
    ).toThrow(/empty text/);
    render(
      <SidebarList
        label="M"
        items={items}
        selectedId={undefined}
        onSelect={vi.fn()}
        emptyText="x"
        // @ts-expect-error closed props: no className
        className="y"
      />,
    );
  });
});

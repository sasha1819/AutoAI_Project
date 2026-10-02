import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "../Button/index.ts";
import { Tooltip } from "./Tooltip.tsx";

const focus = (el: HTMLElement): void => {
  act(() => {
    el.focus();
  });
};

describe("Tooltip", () => {
  it("as a description: opens on keyboard focus and is read after the name", () => {
    render(
      <Tooltip text="Runs every test in this file" purpose="description">
        <Button variant="secondary">Run all</Button>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Run all" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    focus(trigger);
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toBe("Runs every test in this file");
    expect(trigger.getAttribute("aria-describedby")).toBe(tip.id);
  });

  it("as a description: keeps a description the trigger already has, and adds its own", () => {
    render(
      <>
        <p id="own-hint">Saved drafts are kept</p>
        <Tooltip text="Runs every test in this file" purpose="description">
          <Button variant="secondary" aria-describedby="own-hint">
            Run all
          </Button>
        </Tooltip>
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Run all" });
    focus(trigger);
    expect(trigger.getAttribute("aria-describedby")).toBe(
      `own-hint ${screen.getByRole("tooltip").id}`,
    );
  });

  it("as a label: shown, but not linked or read twice", () => {
    render(
      <Tooltip text="Run all" purpose="label">
        <Button variant="secondary">Run all</Button>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Run all" });
    focus(trigger);
    expect(screen.getAllByText("Run all").length).toBeGreaterThan(1);
    expect(trigger.hasAttribute("aria-describedby")).toBe(false);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("closes on Escape and on blur, and focus stays on the trigger", () => {
    render(
      <Tooltip text="More about this" purpose="description">
        <Button variant="secondary">Info</Button>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button");
    focus(trigger);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    act(() => {
      trigger.blur();
    });
    focus(trigger);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    act(() => {
      trigger.blur();
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  // The ts-expect-error lines are checked at typecheck time (part of verify); blank text also throws at runtime.
  it("cannot be blank, and must say what it is for", () => {
    const fromData: string = "​";
    expect(() =>
      render(
        <Tooltip text={fromData} purpose="description">
          <Button>Go</Button>
        </Tooltip>,
      ),
    ).toThrow("Tooltip needs a non-empty label");
    expect(() =>
      render(
        // @ts-expect-error an empty tooltip
        <Tooltip text="" purpose="description">
          <Button>Go</Button>
        </Tooltip>,
      ),
    ).toThrow(/label/);
    render(
      // @ts-expect-error purpose is required: label or description
      <Tooltip text="Go">
        <Button>Go</Button>
      </Tooltip>,
    );
    expect(screen.getByRole("button", { name: "Go" })).toBeTruthy();
  });
});

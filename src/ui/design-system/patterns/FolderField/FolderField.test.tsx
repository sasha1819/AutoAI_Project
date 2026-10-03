import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FolderField } from "./FolderField.tsx";

// What a screen reader adds after the name: the texts the button's aria-describedby points to.
const description = (el: HTMLElement): string =>
  (el.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");

describe("FolderField", () => {
  it("shows the placeholder until a folder is chosen; the button names its field and reads the path", () => {
    const { rerender } = render(
      <FolderField
        label="Project folder"
        path={null}
        placeholder="No folder chosen"
        chooseLabel="Choose folder"
        onChoose={() => undefined}
      />,
    );
    const button = screen.getByRole("button", { name: "Choose folder: Project folder" });
    expect(description(button)).toBe("No folder chosen");
    rerender(
      <FolderField
        label="Project folder"
        path="/work/shop"
        placeholder="No folder chosen"
        chooseLabel="Choose folder"
        onChoose={() => undefined}
        hint="Read on this computer."
      />,
    );
    expect(description(button)).toBe("/work/shop Read on this computer.");
  });

  it("opens the dialog on click or keyboard, and the path is text, not a field to type in", async () => {
    const onChoose = vi.fn();
    render(
      <FolderField
        label="PRD folder"
        path={null}
        placeholder="No folder chosen"
        chooseLabel="Choose folder"
        onChoose={onChoose}
      />,
    );
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(onChoose).toHaveBeenCalledOnce();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("an error marks the box invalid and is read first, before the path and the hint", () => {
    render(
      <FolderField
        label="PRD folder"
        path="/locked"
        placeholder="No folder chosen"
        chooseLabel="Change folder"
        onChoose={() => undefined}
        hint="Markdown or text files."
        error="AutoAI isn't allowed to read this folder."
      />,
    );
    const button = screen.getByRole("button", { name: "Change folder: PRD folder" });
    expect(description(button)).toBe(
      "AutoAI isn't allowed to read this folder. /locked Markdown or text files.",
    );
    expect(screen.getByText("/locked").parentElement?.getAttribute("aria-invalid")).toBe("true");
  });

  it("the visible label is a real label for the button", () => {
    render(
      <FolderField
        label="Project folder"
        path={null}
        placeholder="No folder chosen"
        chooseLabel="Choose folder"
        onChoose={() => undefined}
      />,
    );
    const label = screen.getByText("Project folder");
    expect(label.tagName).toBe("LABEL");
    expect(label.getAttribute("for")).toBe(screen.getByRole("button").id);
  });

  it("ignores presses while busy", async () => {
    const onChoose = vi.fn();
    render(
      <FolderField
        label="PRD folder"
        path={null}
        placeholder="No folder chosen"
        chooseLabel="Choose folder"
        onChoose={onChoose}
        busy
      />,
    );
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-busy")).toBe("true");
    await userEvent.click(button);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("refuses a blank label", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() =>
      render(
        <FolderField
          label=" "
          path={null}
          placeholder="x"
          chooseLabel="Choose folder"
          onChoose={() => undefined}
        />,
      ),
    ).toThrow();
  });
});

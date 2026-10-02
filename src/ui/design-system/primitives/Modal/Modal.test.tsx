import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../Button/index.ts";
import { Input } from "../Input/index.ts";
import { Modal, ModalClose } from "./Modal.tsx";

function Example() {
  return (
    <>
      <p>Page behind</p>
      <Modal
        title="Rename item"
        description="Choose a new name."
        trigger={<Button>Rename</Button>}
        actions={<Button>Save</Button>}
      >
        <Input label="Name" />
      </Modal>
    </>
  );
}

describe("Modal", () => {
  it("is a modal dialog named by its title and described by its description", async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByRole("button", { name: "Rename" }));
    const dialog = screen.getByRole("dialog", { name: "Rename item" });
    expect(dialog.getAttribute("aria-describedby")).toBe(screen.getByText("Choose a new name.").id);
    expect(screen.getByRole("heading", { name: "Rename item" })).toBeTruthy();
  });

  it("hides the page behind from assistive tech", async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByRole("button", { name: "Rename" }));
    expect(screen.getByText("Page behind").closest("[aria-hidden=true]")).not.toBeNull();
  });

  it("focus starts on the first control in the body, not on Close", async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByRole("button", { name: "Rename" }));
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Name" }));
  });

  it("keeps focus inside: Tab cycles through its controls", async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByRole("button", { name: "Rename" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Save" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Name" }));
  });

  it.each([
    ["Escape", async (user: ReturnType<typeof userEvent.setup>) => user.keyboard("{Escape}")],
    [
      "the Close button",
      async (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole("button", { name: "Close" })),
    ],
  ])("closes with %s and returns focus to the trigger", async (_how, close) => {
    const user = userEvent.setup();
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Rename" });
    await user.click(trigger);
    await close(user);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("not dismissible: Escape and a click outside do nothing, and there is no Close; its actions close it", async () => {
    const user = userEvent.setup();
    function Must() {
      const [open, setOpen] = useState(true);
      return (
        <Modal
          title="Answer first"
          open={open}
          onOpenChange={setOpen}
          dismissible={false}
          actions={
            <Button
              onClick={() => {
                setOpen(false);
              }}
            >
              Got it
            </Button>
          }
        />
      );
    }
    render(<Must />);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "Answer first" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opened by app state: on close, focus returns to what opened it", async () => {
    const user = userEvent.setup();
    function FromRow() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button
            onClick={() => {
              setOpen(true);
            }}
          >
            Remove row
          </Button>
          <Modal
            title="Remove it?"
            open={open}
            onOpenChange={setOpen}
            actions={<Button>Remove</Button>}
          />
        </>
      );
    }
    render(<FromRow />);
    const opener = screen.getByRole("button", { name: "Remove row" });
    await user.click(opener);
    expect(screen.getByRole("dialog", { name: "Remove it?" })).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("an action wrapped in ModalClose closes it (uncontrolled too) and focus returns to the trigger", async () => {
    const user = userEvent.setup();
    render(
      <Modal
        title="Rename item"
        trigger={<Button>Rename</Button>}
        actions={
          <ModalClose>
            <Button variant="secondary">Cancel</Button>
          </ModalClose>
        }
      />,
    );
    const trigger = screen.getByRole("button", { name: "Rename" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("when the first control is below the window, focus starts on the dialog itself", () => {
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue(DOMRect.fromRect({ x: 0, y: 5000, width: 10, height: 10 }));
    render(<Modal title="Long" open onOpenChange={vi.fn()} actions={<Button>Done</Button>} />);
    expect(document.activeElement).toBe(screen.getByRole("dialog", { name: "Long" }));
    rect.mockRestore();
  });

  it("dragging the backdrop's scrollbar does not close it; a click on the backdrop does", async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByRole("button", { name: "Rename" }));
    const backdrop = screen.getByRole("dialog").parentElement;
    if (backdrop === null) throw new Error("no backdrop");
    Object.defineProperty(backdrop, "clientWidth", { configurable: true, value: 800 });
    await user.pointer({
      keys: "[MouseLeft]",
      target: backdrop,
      coords: { clientX: 805, clientY: 10 },
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
    await user.pointer({
      keys: "[MouseLeft]",
      target: backdrop,
      coords: { clientX: 100, clientY: 10 },
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("locks the page's scroll while open", async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByRole("button", { name: "Rename" }));
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(true);
    await user.keyboard("{Escape}");
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
  });

  it("a false body (cond && <X/>) leaves no empty gap", () => {
    render(
      <Modal title="Plain" open onOpenChange={vi.fn()}>
        {false}
      </Modal>,
    );
    expect(screen.getByRole("dialog").querySelectorAll(":scope > div")).toHaveLength(2);
  });

  it("controlled by app state, with no trigger", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn<(open: boolean) => void>();
    render(<Modal title="From state" open onOpenChange={onOpenChange} />);
    // Nothing but Close to focus: the dialog itself takes focus, so one Escape closes it.
    expect(document.activeElement).toBe(screen.getByRole("dialog", { name: "From state" }));
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("without a description, it is not described by anything", () => {
    render(<Modal title="Plain" open onOpenChange={vi.fn()} description="  " />);
    expect(screen.getByRole("dialog").hasAttribute("aria-describedby")).toBe(false);
  });

  // The ts-expect-error lines are checked at typecheck time (part of verify); a blank title also throws at runtime.
  it("must be titled, opened somehow, and closable", () => {
    const blank: string = " ";
    expect(() => render(<Modal title={blank} open onOpenChange={vi.fn()} />)).toThrow(
      "Modal needs a non-empty label",
    );
    // @ts-expect-error a dialog without a title
    expect(() => render(<Modal open onOpenChange={vi.fn()} />)).toThrow(/label/);
    // @ts-expect-error neither a trigger nor controlled: it could never open
    render(<Modal title="Never" />);
    render(
      // @ts-expect-error a trigger-opened dialog cannot be undismissible: its actions could not close it
      <Modal
        title="Trapped"
        trigger={<Button>Open</Button>}
        dismissible={false}
        actions={<Button>OK</Button>}
      />,
    );
    // @ts-expect-error open without onOpenChange: Escape and Close could not close it
    render(<Modal title="Deaf" open />);
    // @ts-expect-error not dismissible and no actions: it could never close
    render(<Modal title="Stuck" open onOpenChange={vi.fn()} dismissible={false} />);
    // @ts-expect-error closed props: no className
    render(<Modal title="Styled" open onOpenChange={vi.fn()} className="x" />);
    expect(screen.getAllByRole("dialog").length).toBeGreaterThan(0);
  });
});

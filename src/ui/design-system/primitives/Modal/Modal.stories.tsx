import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../Button/index.ts";
import { Input } from "../Input/index.ts";
import { Modal, ModalClose } from "./Modal.tsx";

const meta: Meta<typeof Modal> = { title: "Primitives/Modal", component: Modal };
export default meta;
type Story = StoryObj<typeof Modal>;

const noop = () => undefined;

// Open (controlled) so the look can be reviewed. A confirmation: small, two actions, the safe one first.
export const Confirmation: Story = {
  render: () => (
    <Modal
      title="Remove this item?"
      description="It can be added again later."
      open
      onOpenChange={noop}
      actions={
        <>
          <Button variant="secondary">Cancel</Button>
          <Button>Remove</Button>
        </>
      }
    />
  ),
};

export const ShortForm: Story = {
  render: () => (
    <Modal
      title="Rename item"
      description="Choose a name that says what it checks."
      size="md"
      open
      onOpenChange={noop}
      actions={
        <>
          <Button variant="secondary">Cancel</Button>
          <Button>Save</Button>
        </>
      }
    >
      <Input label="Name" placeholder="Placeholder text" />
    </Modal>
  ),
};

// Only its actions close it: no Close button, Escape and the backdrop do nothing.
export const NotDismissible: Story = {
  render: () => (
    <Modal
      title="One step needed"
      description="Answer to continue."
      open
      onOpenChange={noop}
      dismissible={false}
      actions={<Button>Continue</Button>}
    />
  ),
};

// Taller than the window: the backdrop scrolls, the dialog is never cut off.
export const LongContent: Story = {
  render: () => (
    <Modal title="Long content" open onOpenChange={noop} size="md" actions={<Button>Done</Button>}>
      <div className="flex flex-col gap-3 text-text-secondary">
        {Array.from({ length: 30 }, (_, i) => (
          <p key={i}>Paragraph {i + 1} of placeholder text.</p>
        ))}
      </div>
    </Modal>
  ),
};

// Closed: the trigger opens it; Escape, the backdrop, Close or Cancel closes it and focus returns to the trigger.
export const Interactive: Story = {
  render: () => (
    <Modal
      title="Rename item"
      trigger={<Button variant="secondary">Open dialog</Button>}
      actions={
        <>
          <ModalClose>
            <Button variant="secondary">Cancel</Button>
          </ModalClose>
          <ModalClose>
            <Button>Save</Button>
          </ModalClose>
        </>
      }
    >
      <Input label="Name" />
    </Modal>
  ),
};

function FromState() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setOpen(true);
        }}
      >
        Remove row
      </Button>
      <Modal
        title="Remove this item?"
        open={open}
        onOpenChange={setOpen}
        actions={
          <>
            <ModalClose>
              <Button variant="secondary">Cancel</Button>
            </ModalClose>
            <ModalClose>
              <Button>Remove</Button>
            </ModalClose>
          </>
        }
      />
    </>
  );
}
// Opened by the screen's state (a row action), not a trigger: focus still returns to the button on close.
export const OpenedByAppState: Story = { render: () => <FromState /> };

export const NoDescription: Story = {
  render: () => (
    <Modal title="Just a title" open onOpenChange={noop} actions={<Button>OK</Button>} />
  ),
};

export const SmallWithBody: Story = {
  render: () => (
    <Modal title="Small dialog" open onOpenChange={noop} actions={<Button>Done</Button>}>
      <p className="text-text-secondary">A short paragraph in the body of a small dialog.</p>
    </Modal>
  ),
};

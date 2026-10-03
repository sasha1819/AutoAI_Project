import type { Meta, StoryObj } from "@storybook/react-vite";
import { LinkButton } from "./LinkButton.tsx";

const meta: Meta<typeof LinkButton> = {
  title: "Primitives/LinkButton",
  component: LinkButton,
  args: { children: "Some linked words", onClick: () => undefined },
};
export default meta;
type Story = StoryObj<typeof LinkButton>;

const InSentence = (args: { readonly external?: boolean }) => (
  <p className="text-sm text-text-secondary">
    A sentence with{" "}
    <LinkButton external={args.external ?? false} onClick={() => undefined}>
      some linked words
    </LinkButton>{" "}
    inside it.
  </p>
);

export const Default: Story = {};
export const External: Story = { args: { external: true } };
export const InASentence: Story = { render: () => <InSentence /> };
export const ExternalInASentence: Story = { render: () => <InSentence external /> };
export const Hover: Story = {
  render: (args) => (
    <div data-preview-state="hover">
      <LinkButton {...args} />
    </div>
  ),
};
export const FocusVisible: Story = {
  render: (args) => (
    <div data-preview-state="focus-visible">
      <LinkButton {...args} external />
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus } from "lucide-react";
import { Button } from "../Button/index.ts";
import { Card } from "./Card.tsx";

const meta: Meta<typeof Card> = {
  title: "Primitives/Card",
  component: Card,
  decorators: [(Story) => <div className="w-120">{Story()}</div>],
};
export default meta;
type Story = StoryObj<typeof Card>;

// A card is not interactive, so it has no hover, focus or disabled states: controls inside it carry their own.

const Body = () => (
  <div className="flex flex-col gap-1">
    <p className="text-md font-medium text-text-primary">A title</p>
    <p className="text-md text-text-secondary">Body text inside the card.</p>
  </div>
);

export const Surface: Story = { render: () => <Card>{Body()}</Card> };
export const Sunken: Story = { render: () => <Card tone="sunken">{Body()}</Card> };

// A box inside a card, as "Quick facts" in mockup 7.
export const SunkenInsideSurface: Story = {
  render: () => (
    <Card>
      <div className="flex flex-col gap-3">
        {Body()}
        <Card tone="sunken">
          <p className="text-sm text-text-secondary">Details in an inner box</p>
        </Card>
      </div>
    </Card>
  ),
};

// Row-like cards: one line and a small action (mockup 9 suggestions, mockup 6 "Not covered yet").
export const SmallRows: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      {(["surface", "sunken"] as const).map((tone) => (
        <Card key={tone} tone={tone} size="sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-md text-text-primary">A {tone} row</span>
            <Button variant="secondary" size="sm" icon={Plus}>
              Add
            </Button>
          </div>
        </Card>
      ))}
    </div>
  ),
};

export const ArticleWithHeading: Story = {
  render: () => (
    <Card as="article" labelledBy="story-card-title">
      <h3 id="story-card-title" className="text-md font-medium text-text-primary">
        A named article
      </h3>
      <p className="text-md text-text-secondary">Screen readers announce it by its heading.</p>
    </Card>
  ),
};

export const ListOfCards: Story = {
  render: () => (
    <ul className="flex flex-col gap-3">
      <Card as="li">{Body()}</Card>
      <Card as="li">{Body()}</Card>
    </ul>
  ),
};

export const LongContent: Story = {
  render: () => (
    <Card>
      <p className="text-md break-words text-text-secondary">
        A long unbroken value such as
        averyveryverylongidentifierwithoutanyspacesatallthatmustnotoverflowthecard wraps inside the
        card instead of pushing it wider.
      </p>
    </Card>
  ),
};

// On every page background a card can sit on.
export const OnBackgrounds: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {(["bg-app", "bg-canvas"] as const).map((bg) => (
        <div key={bg} className={`p-4 ${bg}`}>
          <Card>{Body()}</Card>
        </div>
      ))}
    </div>
  ),
};

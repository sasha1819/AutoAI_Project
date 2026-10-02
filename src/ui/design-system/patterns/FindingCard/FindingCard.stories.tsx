import type { Meta, StoryObj } from "@storybook/react-vite";
import { ExternalLink } from "lucide-react";
import { Button } from "../../primitives/Button/index.ts";
import { AiActionButton } from "../AiActionButton/index.ts";
import { FindingCard } from "./FindingCard.tsx";
import { exampleFinding } from "./finding-fixture.ts";

const meta: Meta<typeof FindingCard> = {
  title: "Patterns/FindingCard",
  component: FindingCard,
  decorators: [(Story) => <div className="w-300 bg-canvas p-6">{Story()}</div>],
};
export default meta;
type Story = StoryObj<typeof FindingCard>;

const Actions = () => (
  <>
    <AiActionButton label="Start an AI action" onClick={() => undefined} />
    <Button variant="secondary">Secondary action</Button>
    <Button variant="secondary" icon={ExternalLink}>
      Another action
    </Button>
  </>
);

// The shape of mockup 11 (placeholder text).
export const Mismatch: Story = { args: { finding: exampleFinding(), actions: <Actions /> } };
export const MediumSeverity: Story = {
  args: { finding: exampleFinding({ severity: "medium" }), actions: <Actions /> },
};
// Not confirmed: tagged, hedged, the reasons in words; never shown as fact.
export const NeedsReview: Story = {
  args: {
    finding: exampleFinding({
      confidence: 0.55,
      reviewStatus: "needs_review",
      reviewReasons: ["LOW_CONFIDENCE", "UNVERIFIED_EVIDENCE"],
    }),
    actions: <Actions />,
  },
};
export const NotImplemented: Story = {
  args: {
    finding: exampleFinding({ type: "not_implemented", severity: "medium", evidence: null }),
  },
};
// No severity (a match always; a mismatch when the AI gave none): nothing in its place.
export const NoSeverity: Story = {
  args: { finding: exampleFinding({ severity: null }), actions: <Actions /> },
};
export const Narrow: Story = {
  args: { finding: exampleFinding(), actions: <Actions /> },
  decorators: [(Story) => <div className="w-120 bg-canvas p-4">{Story()}</div>],
};

export const Match: Story = {
  args: { finding: exampleFinding({ type: "match", severity: null }) },
};
// Not implemented, and not confirmed: hedged as well.
export const NotImplementedNeedsReview: Story = {
  args: {
    finding: exampleFinding({
      type: "not_implemented",
      severity: "low",
      evidence: null,
      confidence: 0.5,
      reviewStatus: "needs_review",
      reviewReasons: ["LOW_CONFIDENCE"],
    }),
  },
};

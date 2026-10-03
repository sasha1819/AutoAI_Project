import { Confidence } from "../../../core/domain/confidence.ts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import type { ScanReport } from "../../../contracts/scan.ts";
import { BROKEN_MESSAGE } from "../../app/bridge.ts";
import { SCAN_MESSAGE } from "./messages.ts";
import { ScanView, type ScanViewProps } from "./Scan.tsx";
import type { Timed } from "./scan-steps.ts";

const noop = () => undefined;
const base: ScanViewProps = {
  repoRoot: "/Users/sam/code/web-app",
  events: [],
  outcome: "running",
  report: null,
  onSeeResults: noop,
  onBack: noop,
  onConnectAi: noop,
};
const Frame = (Story: () => ReactNode) => <div className="h-screen bg-canvas">{Story()}</div>;

const meta: Meta<typeof ScanView> = {
  title: "Screens/Scan",
  component: ScanView,
  args: base,
  parameters: { layout: "fullscreen" },
  decorators: [Frame],
};
export default meta;
type Story = StoryObj<typeof ScanView>;

const read: Timed[] = [
  { at: 0, progress: { stage: "reading_prds" } },
  { at: 120, progress: { stage: "prds_read", prdFiles: 3, requirements: 29 } },
  { at: 130, progress: { stage: "reading_code" } },
  { at: 1830, progress: { stage: "code_read", sourceFiles: 214 } },
];
const comparing: Timed[] = [
  ...read,
  { at: 1900, progress: { stage: "matching", area: "Accounts", batch: 1, batches: 4 } },
  { at: 21900, progress: { stage: "matching", area: "Billing", batch: 2, batches: 4 } },
];
const finished: Timed[] = [
  ...comparing,
  { at: 41900, progress: { stage: "matching", area: "Search", batch: 3, batches: 4 } },
  { at: 61900, progress: { stage: "matching", area: "Settings", batch: 4, batches: 4 } },
  { at: 80000, progress: { stage: "done" } },
];
const report: ScanReport = {
  prdFiles: ["accounts.md", "billing.md", "search.md"],
  sourceFiles: 214,
  requirements: Array.from({ length: 29 }, (_, i) => ({
    tag: `Accounts ${String(i + 1)}`,
    area: "Accounts",
    text: "A requirement.",
    source: { file: "accounts.md", line: i + 1 },
  })),
  findings: [],
  notScanned: [],
  needsReview: [],
  extraction: { files: 0, dropped: 0 },
  warnings: [{ code: "SOURCE_FILE_UNREADABLE", message: "x" }],
  stoppedBy: null,
  models: ["claude-sonnet-5"],
  usage: { aiCalls: 4, inputTokens: 48210, outputTokens: 6130 },
};

export const Starting: Story = {
  args: { events: [{ at: 0, progress: { stage: "reading_prds" } }] },
};
export const ReadingCode: Story = { args: { events: read.slice(0, 3) } };
export const Comparing: Story = { args: { events: comparing } };
export const Complete: Story = { args: { events: finished, outcome: "done", report } };
export const NothingToCompare: Story = {
  args: {
    events: [
      { at: 0, progress: { stage: "reading_prds" } },
      { at: 10, progress: { stage: "prds_read", prdFiles: 2, requirements: 0 } },
      { at: 11, progress: { stage: "reading_code" } },
      { at: 900, progress: { stage: "code_read", sourceFiles: 214 } },
      { at: 901, progress: { stage: "done" } },
    ],
    outcome: "done",
    report: { ...report, usage: { aiCalls: 0, inputTokens: 0, outputTokens: 0 }, warnings: [] },
  },
};
export const PlainProsePrds: Story = {
  args: {
    events: [
      { at: 0, progress: { stage: "reading_prds" } },
      { at: 10, progress: { stage: "prds_read", prdFiles: 2, requirements: 0 } },
      { at: 11, progress: { stage: "extracting", file: "vision.md", index: 1, total: 2 } },
      { at: 9000, progress: { stage: "extracting", file: "roadmap.md", index: 2, total: 2 } },
    ],
  },
};
export const PlainProseComplete: Story = {
  args: {
    events: [
      { at: 0, progress: { stage: "reading_prds" } },
      { at: 10, progress: { stage: "prds_read", prdFiles: 2, requirements: 0 } },
      { at: 11, progress: { stage: "extracting", file: "vision.md", index: 1, total: 2 } },
      { at: 9000, progress: { stage: "extracting", file: "roadmap.md", index: 2, total: 2 } },
      { at: 16000, progress: { stage: "extracted", requirements: 6, needsReview: 2 } },
      { at: 16001, progress: { stage: "reading_code" } },
      { at: 17500, progress: { stage: "code_read", sourceFiles: 214 } },
      { at: 17600, progress: { stage: "matching", area: "Checkout", batch: 1, batches: 2 } },
      { at: 30000, progress: { stage: "matching", area: "Search", batch: 2, batches: 2 } },
      { at: 41000, progress: { stage: "done" } },
    ],
    outcome: "done",
    report: {
      ...report,
      needsReview: [
        {
          area: "Checkout",
          text: "Checkout should feel calm.",
          source: { file: "vision.md", line: 7 },
          quote: { lines: [7, 7], snippet: "We want checkout to feel calm." },
          confidence: Confidence.parse(0.4),
        },
        {
          area: "Search",
          text: "Search results load quickly.",
          source: { file: "roadmap.md", line: 3 },
          quote: { lines: [3, 3], snippet: "Search should be quick." },
          confidence: Confidence.parse(0.6),
        },
      ],
      extraction: { files: 2, dropped: 1 },
    },
  },
};
export const StoppedWhileReadingPrds: Story = {
  args: {
    events: [
      { at: 0, progress: { stage: "reading_prds" } },
      { at: 10, progress: { stage: "prds_read", prdFiles: 2, requirements: 0 } },
      { at: 11, progress: { stage: "extracting", file: "vision.md", index: 1, total: 2 } },
    ],
    outcome: "failed",
    error: BROKEN_MESSAGE,
    errorCode: null,
  },
};
export const ClaudeStoppedBeforeComparing: Story = {
  args: {
    events: [
      { at: 0, progress: { stage: "reading_prds" } },
      { at: 10, progress: { stage: "prds_read", prdFiles: 2, requirements: 0 } },
      { at: 11, progress: { stage: "extracting", file: "vision.md", index: 1, total: 2 } },
      { at: 900, progress: { stage: "extracted", requirements: 0, needsReview: 0 } },
      { at: 901, progress: { stage: "reading_code" } },
      { at: 2000, progress: { stage: "code_read", sourceFiles: 214 } },
      { at: 2001, progress: { stage: "done" } },
    ],
    outcome: "stopped",
    report: {
      ...report,
      stoppedBy: { code: "AI_RATE_LIMITED", message: "429" },
      extraction: { files: 0, dropped: 0 },
    },
  },
};
export const CompleteWithPrdWarnings: Story = {
  args: {
    events: finished,
    outcome: "done",
    report: {
      ...report,
      warnings: [
        { code: "PRD_TOO_LARGE", message: "everything.md: 120431 characters" },
        { code: "EXTRACTION_FAILED", message: "notes.md: invalid answer" },
      ],
    },
  },
};
export const StoppedByClaude: Story = {
  args: {
    events: [...comparing, { at: 30000, progress: { stage: "done" } }],
    outcome: "stopped",
    report: { ...report, stoppedBy: { code: "AI_RATE_LIMITED", message: "429" } },
  },
};
export const FolderGone: Story = {
  args: {
    events: read.slice(0, 3),
    outcome: "failed",
    error: SCAN_MESSAGE.PATH_NOT_FOUND,
    errorCode: "PATH_NOT_FOUND",
  },
};
export const KeyGoneAway: Story = {
  args: { outcome: "failed", error: SCAN_MESSAGE.NO_KEY, errorCode: "NO_KEY" },
};
export const KeyRejectedMidScan: Story = {
  args: {
    events: [...comparing, { at: 30000, progress: { stage: "done" } }],
    outcome: "stopped",
    report: { ...report, stoppedBy: { code: "AI_AUTH_FAILED", message: "401" } },
  },
};
export const LongAreaName: Story = {
  args: {
    events: [
      ...read,
      {
        at: 1900,
        progress: {
          stage: "matching",
          area: "Account settings, notification preferences and data export for team administrators",
          batch: 1,
          batches: 2,
        },
      },
    ],
  },
};
export const KeyUnreadable: Story = {
  args: {
    outcome: "failed",
    error: SCAN_MESSAGE.SECRET_STORE_FAILED,
    errorCode: "SECRET_STORE_FAILED",
  },
};
export const BrokenReply: Story = {
  args: { outcome: "failed", error: BROKEN_MESSAGE, errorCode: null },
};

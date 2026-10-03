import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { BROKEN_MESSAGE } from "../../app/bridge.ts";
import { AddProjectView, type AddProjectViewProps } from "./AddProject.tsx";
import { READ_PRDS_MESSAGE, KEY_MESSAGE } from "./messages.ts";

const noop = () => undefined;
const repo = "/Users/sam/code/web-app";
const prdFolder = "/Users/sam/code/web-app/docs/prds";
const base: AddProjectViewProps = {
  ai: { kind: "connected" },
  onConnectAi: noop,
  repoFolder: null,
  prdFolder: null,
  prds: { kind: "none" },
  picking: null,
  onChooseRepo: noop,
  onChoosePrds: noop,
  project: null,
  onScan: noop,
};
const Frame = (Story: () => ReactNode) => <div className="h-screen bg-canvas">{Story()}</div>;

const meta: Meta<typeof AddProjectView> = {
  title: "Screens/AddProject",
  component: AddProjectView,
  args: base,
  parameters: { layout: "fullscreen" },
  decorators: [Frame],
};
export default meta;
type Story = StoryObj<typeof AddProjectView>;

export const NothingChosen: Story = {};
export const PickingProjectFolder: Story = { args: { picking: "repo" } };
export const PickingPrdFolder: Story = {
  args: { repoFolder: repo, picking: "prds", project: { repoRoot: repo, prdFolder: null } },
};
export const ProjectChosen: Story = {
  args: { repoFolder: repo, project: { repoRoot: repo, prdFolder: null } },
};
export const ReadingPrds: Story = {
  args: { repoFolder: repo, prdFolder, prds: { kind: "reading" } },
};
export const PrdsRead: Story = {
  args: {
    repoFolder: repo,
    prdFolder,
    prds: {
      kind: "read",
      summary: {
        files: [
          { file: "accounts.md", requirements: 14, chars: 1200, claude: "not_needed" },
          { file: "billing.md", requirements: 9, chars: 1200, claude: "not_needed" },
          { file: "search.md", requirements: 6, chars: 1200, claude: "not_needed" },
        ],
        requirements: 29,
        maxChars: 50000,
        extraCalls: 0,
      },
    },
    project: { repoRoot: repo, prdFolder },
  },
};
export const SomeFilesWithoutRequirements: Story = {
  args: {
    ...PrdsRead.args,
    prds: {
      kind: "read",
      summary: {
        files: [
          { file: "accounts.md", requirements: 14, chars: 1200, claude: "not_needed" },
          { file: "vision.md", requirements: 0, chars: 1200, claude: "will_read" },
        ],
        requirements: 14,
        maxChars: 50000,
        extraCalls: 1,
      },
    },
  },
};
export const PlainProsePrds: Story = {
  args: {
    repoFolder: repo,
    prdFolder,
    prds: {
      kind: "read",
      summary: {
        files: [
          { file: "vision.md", requirements: 0, chars: 1200, claude: "will_read" },
          { file: "roadmap.txt", requirements: 0, chars: 1200, claude: "will_read" },
        ],
        requirements: 0,
        maxChars: 50000,
        extraCalls: 2,
      },
    },
    project: { repoRoot: repo, prdFolder },
  },
};
export const PrdTooLarge: Story = {
  args: {
    repoFolder: repo,
    prdFolder,
    prds: {
      kind: "read",
      summary: {
        files: [{ file: "everything.md", requirements: 0, chars: 120431, claude: "too_large" }],
        requirements: 0,
        maxChars: 50000,
        extraCalls: 0,
      },
    },
    project: { repoRoot: repo, prdFolder },
  },
};
export const ParsedAndPlainProse: Story = {
  args: {
    repoFolder: repo,
    prdFolder,
    prds: {
      kind: "read",
      summary: {
        files: [
          { file: "accounts.md", requirements: 14, chars: 4200, claude: "not_needed" },
          { file: "vision.md", requirements: 0, chars: 3100, claude: "will_read" },
          { file: "everything.md", requirements: 0, chars: 120431, claude: "too_large" },
        ],
        requirements: 14,
        maxChars: 50000,
        extraCalls: 1,
      },
    },
    project: { repoRoot: repo, prdFolder },
  },
};
export const NoPrdFiles: Story = {
  args: {
    repoFolder: repo,
    prdFolder: "/Users/sam/Pictures",
    prds: { kind: "no-files" },
    project: { repoRoot: repo, prdFolder: "/Users/sam/Pictures" },
  },
};
export const UnreadablePrdFolder: Story = {
  args: {
    repoFolder: repo,
    prdFolder,
    prds: { kind: "failed", message: READ_PRDS_MESSAGE.PATH_UNREADABLE },
  },
};
export const BrokenDialog: Story = {
  args: { notice: BROKEN_MESSAGE },
};
const noKey = { kind: "missing", message: KEY_MESSAGE.NO_KEY } as const;
export const NoKeyNothingChosen: Story = { args: { ai: noKey } };
export const NoKeyYet: Story = { args: { ...PrdsRead.args, ai: noKey } };
export const SavedKeyUnreadable: Story = {
  args: {
    ...ProjectChosen.args,
    ai: { kind: "missing", message: KEY_MESSAGE.SECRET_STORE_UNAVAILABLE },
  },
};
export const CheckingConnection: Story = {
  args: { ...ProjectChosen.args, ai: { kind: "checking" } },
};
export const NoKeyNarrowWindow: Story = {
  args: { ...NoKeyYet.args },
  decorators: [(Story) => <div className="w-100">{Story()}</div>],
};
export const ProsePrdsNoKey: Story = {
  args: { ...PlainProsePrds.args, ai: noKey },
};

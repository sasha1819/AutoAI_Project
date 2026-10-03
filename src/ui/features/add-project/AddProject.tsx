import { type ReactNode, useId } from "react";
import type { PrdSummary } from "../../../contracts/project.ts";
import { plural } from "../../design-system/wording/index.ts";
import { FolderField } from "../../design-system/patterns/FolderField/index.ts";
import { PageColumn } from "../../design-system/patterns/PageColumn/index.ts";
import { Badge } from "../../design-system/primitives/Badge/index.ts";
import { Button } from "../../design-system/primitives/Button/index.ts";
import { Card } from "../../design-system/primitives/Card/index.ts";
import { Check } from "../../design-system/primitives/Icon/index.ts";
import { Spinner } from "../../design-system/primitives/Spinner/index.ts";
import { CHECKING_CONNECTION } from "./messages.ts";
import {
  type AiState,
  type ChosenFolders,
  type PrdState,
  type Project,
  useAddProject,
} from "./useAddProject.ts";

export type AddProjectViewProps = {
  /** Without a key, Scan is disabled and the screen offers the way back to Connect Claude. */
  readonly ai: AiState;
  readonly onConnectAi: () => void;
  readonly repoFolder: string | null;
  readonly prdFolder: string | null;
  readonly prds: PrdState;
  readonly picking: "repo" | "prds" | null;
  readonly notice?: string | undefined;
  readonly onChooseRepo: () => void;
  readonly onChoosePrds: () => void;
  /** What Scan will scan; null until a project folder is chosen (or while the PRDs are read). */
  readonly project: Project | null;
  readonly onScan: (project: Project) => void;
};

// How AutoAI finds requirements, said wherever it found none: the parser reads headings and tagged lines only.
const FORMAT_HELP =
  "AutoAI finds requirements under headings (## Checkout) and in tagged lines (Cart 2.4: Codes are case-insensitive). Paragraphs without either are not read as requirements.";
const NOTHING_TO_COMPARE = "You can still scan without them; there will be nothing to compare yet.";

/**
 * Add your project (PRD Flow 1 step 3; mockup 3's top part). The user picks the project folder and, optionally, a
 * PRD folder with the system dialog; the PRDs are read at once (no AI), so a folder without PRD files, or PRDs in
 * plain prose (0 requirements), is said plainly before any scan. Scanning itself is the next screen.
 */
export function AddProjectView(props: AddProjectViewProps) {
  const { ai, repoFolder, prdFolder, prds, picking, notice, project } = props;
  const noteId = useId();
  return (
    <PageColumn>
      <h1 className="text-xl font-bold text-text-primary">Add your project</h1>
      <p className="mt-2 text-md text-text-secondary">
        Choose your project's folder and the PRDs that describe it. AutoAI compares the two.
      </p>

      <div className="mt-8">
        <FolderField
          label="Project folder"
          path={repoFolder}
          placeholder="No folder chosen"
          chooseLabel={repoFolder === null ? "Choose folder" : "Change folder"}
          onChoose={props.onChooseRepo}
          busy={picking === "repo"}
          hint="Your code is read on this computer. During a scan, only the parts relevant to each requirement are sent to Claude."
        />
      </div>

      <div className="mt-8">
        <FolderField
          label="PRD folder (optional)"
          path={prdFolder}
          placeholder="No folder chosen"
          chooseLabel={prdFolder === null ? "Choose folder" : "Change folder"}
          onChoose={props.onChoosePrds}
          busy={picking === "prds" || prds.kind === "reading"}
          {...(prds.kind === "failed" ? { error: prds.message } : {})}
          hint="Your product requirement docs, as Markdown (.md) or text files. AutoAI reads them to know what the product should do."
        />
      </div>
      <PrdFindings prds={prds} />

      {/* Always on the page, so a notice that arrives later is announced. */}
      <div role="status">
        {notice !== undefined && <p className="mt-3 text-sm text-text-secondary">{notice}</p>}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Button
          size="xl"
          // Mirrors the service's NO_KEY (the real check), so the UI never reaches that error.
          disabled={project === null || ai.kind !== "connected"}
          aria-describedby={noteId}
          onClick={() => {
            if (project !== null) props.onScan(project);
          }}
        >
          Scan project
        </Button>
        {ai.kind === "missing" && (
          <Button variant="secondary" size="xl" onClick={props.onConnectAi}>
            Connect Claude
          </Button>
        )}
      </div>
      {/* Under the actions (it can be two lines); a live region, so a change in what Scan will do is announced. */}
      <p
        id={noteId}
        role="status"
        className="mt-3 flex items-center gap-1.5 text-sm text-text-muted"
      >
        {scanNoteFor(ai, prds, repoFolder)}
      </p>
    </PageColumn>
  );
}

/** The line under Scan: why it cannot run yet, or what it will do. */
function scanNoteFor(ai: AiState, prds: PrdState, repoFolder: string | null) {
  if (ai.kind === "checking")
    return (
      <>
        <Spinner decorative size="sm" />
        {CHECKING_CONNECTION}
      </>
    );
  if (ai.kind === "missing") return ai.message;
  return scanNote(prds, repoFolder);
}

const BILLED = "Uses your API key (billed by Anthropic).";

/** What Scan will do, so nobody starts a scan without knowing whether it uses their API key, and how much. */
function scanNote(prds: PrdState, repoFolder: string | null): string {
  if (repoFolder === null) return "Choose your project's folder to scan it.";
  if (prds.kind === "reading") return "Scan waits until your PRDs are read.";
  if (prds.kind === "failed") return "Choose a PRD folder AutoAI can read to scan.";
  const parsed = prds.kind === "read" ? prds.summary.requirements : 0;
  const prose = prds.kind === "read" ? proseFiles(prds.summary).length : 0;
  // ADR 0008: the extra calls are said before Scan (user decision); the count comes from core/rules.
  const calls = prds.kind === "read" ? prds.summary.extraCalls : 0;
  const reads = `Claude reads ${plural(prose, "PRD file")} written as prose (${plural(calls, "extra call")})`;
  if (prose > 0 && parsed > 0)
    return `${reads}, then compares what it finds and the ${plural(parsed, "requirement")} with your code. ${BILLED}`;
  if (prose > 0) return `${reads}, then compares what it finds with your code. ${BILLED}`;
  if (parsed > 0)
    return `Claude compares ${plural(parsed, "requirement")} with your code. ${BILLED}`;
  // True of scanProject: with no requirements and nothing for Claude to read, it asks the AI nothing.
  return "With no requirements, the scan only reads your code. It makes no AI calls.";
}

const proseFiles = (summary: PrdSummary) => summary.files.filter((f) => f.claude === "will_read");
const tooLarge = (summary: PrdSummary) => summary.files.filter((f) => f.claude === "too_large");

// One sentence for what happens to prose PRDs, used wherever they are named (ADR 0008).
const QUOTE_RULE =
  "Each requirement it finds must be quoted from your PRD; the ones it is unsure of are listed for your review and not compared.";

/** What the chosen PRD folder holds. The first line is a live region: it is short and always there. */
function PrdFindings({ prds }: { readonly prds: PrdState }) {
  if (prds.kind === "none") return <p role="status" />;
  const prose = prds.kind === "read" ? proseFiles(prds.summary) : [];
  return (
    <div className="mt-3 flex flex-col gap-3">
      <p role="status" className="flex items-center gap-1.5 text-sm text-text-secondary">
        {prdSummaryLine(prds)}
      </p>
      {prds.kind === "read" && prds.summary.requirements > 0 && <FileList summary={prds.summary} />}
      {prds.kind === "read" && prds.summary.requirements === 0 && (
        <Notice
          title={prose.length > 0 ? "Your PRDs are written as prose" : "No requirements found"}
        >
          <p>{FORMAT_HELP}</p>
          {prose.length > 0 ? (
            <ProseLine files={prose.map((f) => f.file)} />
          ) : (
            <p>Add headings to your PRDs, then choose the folder again. {NOTHING_TO_COMPARE}</p>
          )}
          <TooLargeLines summary={prds.summary} />
        </Notice>
      )}
      {prds.kind === "no-files" && (
        <Notice title="No PRD files in this folder">
          <p>
            AutoAI reads .md, .markdown and .txt files. It skips hidden folders, node_modules and
            build output.
          </p>
          <p>Choose the folder that holds your PRDs. {NOTHING_TO_COMPARE}</p>
        </Notice>
      )}
    </div>
  );
}

/** Which files Claude reads, and the rule its findings follow (one wording everywhere). */
function ProseLine({ files }: { readonly files: readonly string[] }) {
  return (
    <p>
      {files.join(", ")} {files.length === 1 ? "is" : "are"} written as prose, so Claude reads{" "}
      {files.length === 1 ? "it" : "them"} during the scan. {QUOTE_RULE}
    </p>
  );
}

/** Files over the size cap: named, with their size and the limit, and what to do (never cut silently). */
function TooLargeLines({ summary }: { readonly summary: PrdSummary }) {
  return (
    <>
      {tooLarge(summary).map((f) => (
        <p key={f.file}>
          {f.file} is too large for Claude to read ({f.chars.toLocaleString("en-US")} characters;
          the limit is {summary.maxChars.toLocaleString("en-US")}). Split it into smaller files, or
          add headings so AutoAI can read it without Claude.
        </p>
      ))}
    </>
  );
}

/** The short line announced when the PRDs are read. What Scan will do with them is said once, under Scan. */
function prdSummaryLine(prds: PrdState) {
  switch (prds.kind) {
    case "none":
      return "";
    case "reading":
      return (
        <>
          <Spinner decorative size="sm" />
          Reading your PRDs…
        </>
      );
    case "read": {
      const { requirements, files } = prds.summary;
      const found =
        requirements === 0
          ? `No requirements found in ${plural(files.length, "PRD file")}.`
          : `Found ${plural(requirements, "requirement")} in ${plural(files.length, "PRD file")}.`;
      const large = tooLarge(prds.summary).length;
      return large === 0
        ? found
        : `${found} ${plural(large, "file")} ${large === 1 ? "is" : "are"} too large for Claude.`;
    }
    case "no-files":
      return "No PRD files in this folder.";
    case "failed":
      // The reason sits under the field; this short line is what is announced.
      return "The PRD folder couldn't be read.";
  }
}

const CLAIM: Record<PrdSummary["files"][number]["claude"], string> = {
  not_needed: "",
  will_read: " · read by Claude",
  too_large: " · too large for Claude",
};

function FileList({ summary }: { readonly summary: PrdSummary }) {
  const prose = proseFiles(summary);
  return (
    <>
      <ul className="flex flex-wrap gap-2" aria-label="PRD files">
        {summary.files.map((f) => (
          <li key={f.file}>
            <Badge
              label={`${f.file} · ${plural(f.requirements, "requirement")}${CLAIM[f.claude]}`}
              {...(f.requirements > 0 ? { icon: Check } : {})}
            />
          </li>
        ))}
      </ul>
      {(prose.length > 0 || tooLarge(summary).length > 0) && (
        <div className="flex flex-col gap-1 text-sm text-text-muted">
          {prose.length > 0 && <ProseLine files={prose.map((f) => f.file)} />}
          <TooLargeLines summary={summary} />
        </div>
      )}
    </>
  );
}

function Notice({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <Card tone="sunken">
      <div className="flex flex-col gap-2 text-sm text-text-secondary">
        <p className="text-md font-semibold text-text-primary">{title}</p>
        {children}
      </div>
    </Card>
  );
}

/** The Add project screen: its hook and its view. */
export function AddProject({
  folders,
  onFoldersChange,
  onScan,
  onConnectAi,
}: {
  /** Folders chosen on an earlier visit (the app keeps them while the user connects Claude). */
  readonly folders: ChosenFolders;
  readonly onFoldersChange: (folders: ChosenFolders) => void;
  readonly onScan: (project: Project) => void;
  readonly onConnectAi: () => void;
}) {
  const p = useAddProject(folders, onFoldersChange);
  return (
    <AddProjectView
      ai={p.ai}
      onConnectAi={onConnectAi}
      repoFolder={p.repoFolder}
      prdFolder={p.prdFolder}
      prds={p.prds}
      picking={p.picking}
      notice={p.notice}
      onChooseRepo={p.chooseRepo}
      onChoosePrds={p.choosePrds}
      project={p.project}
      onScan={onScan}
    />
  );
}

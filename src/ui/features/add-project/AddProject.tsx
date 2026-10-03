import type { ReactNode } from "react";
import type { PrdSummary } from "../../../contracts/project.ts";
import { FolderField } from "../../design-system/patterns/FolderField/index.ts";
import { PageColumn } from "../../design-system/patterns/PageColumn/index.ts";
import { Badge } from "../../design-system/primitives/Badge/index.ts";
import { Button } from "../../design-system/primitives/Button/index.ts";
import { Card } from "../../design-system/primitives/Card/index.ts";
import { Check } from "../../design-system/primitives/Icon/index.ts";
import { Spinner } from "../../design-system/primitives/Spinner/index.ts";
import { type PrdState, type Project, useAddProject } from "./useAddProject.ts";

export type AddProjectViewProps = {
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

const plural = (n: number, word: string): string => `${String(n)} ${word}${n === 1 ? "" : "s"}`;

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
  const { repoFolder, prdFolder, prds, picking, notice, project } = props;
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

      <div className="mt-10 flex items-center gap-6">
        <Button
          size="xl"
          disabled={project === null}
          onClick={() => {
            if (project !== null) props.onScan(project);
          }}
        >
          Scan project
        </Button>
        <p className="text-sm text-text-muted">{scanNote(prds, repoFolder)}</p>
      </div>
    </PageColumn>
  );
}

/** What Scan will do, so nobody starts a scan without knowing whether it uses their API key. */
function scanNote(prds: PrdState, repoFolder: string | null): string {
  if (repoFolder === null) return "Choose your project's folder to scan it.";
  if (prds.kind === "reading") return "Scan waits until your PRDs are read.";
  if (prds.kind === "failed") return "Choose a PRD folder AutoAI can read to scan.";
  if (prds.kind === "read" && prds.summary.requirements > 0)
    return `Claude compares ${plural(prds.summary.requirements, "requirement")} with your code, using your API key (billed by Anthropic).`;
  // True of scanProject today: with no requirements it has no batches, so it asks the AI nothing.
  return "With no requirements, the scan only reads your code. It makes no AI calls.";
}

/** What the chosen PRD folder holds. The first line is a live region: it is short and always there. */
function PrdFindings({ prds }: { readonly prds: PrdState }) {
  return (
    <div className={`flex flex-col gap-3 ${prds.kind === "none" ? "" : "mt-3"}`}>
      <p role="status" className="flex items-center gap-1.5 text-sm text-text-secondary">
        {prdSummaryLine(prds)}
      </p>
      {prds.kind === "read" && prds.summary.requirements > 0 && (
        <FileList files={prds.summary.files} />
      )}
      {prds.kind === "read" && prds.summary.requirements === 0 && (
        <Notice title="No requirements found">
          <p>
            AutoAI read {plural(prds.summary.files.length, "PRD file")} but found no requirements in{" "}
            {prds.summary.files.length === 1 ? "it" : "them"}. {FORMAT_HELP}
          </p>
          <p>Add headings to your PRDs, then choose the folder again. {NOTHING_TO_COMPARE}</p>
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
    case "read":
      return prds.summary.requirements === 0
        ? `No requirements found in ${plural(prds.summary.files.length, "PRD file")}.`
        : `Found ${plural(prds.summary.requirements, "requirement")} in ${plural(prds.summary.files.length, "PRD file")}.`;
    case "no-files":
      return "No PRD files in this folder.";
    case "failed":
      // The reason sits under the field; this short line is what is announced.
      return "The PRD folder couldn't be read.";
  }
}

function FileList({ files }: { readonly files: PrdSummary["files"] }) {
  const empty = files.filter((f) => f.requirements === 0).map((f) => f.file);
  return (
    <>
      <ul className="flex flex-wrap gap-2" aria-label="PRD files">
        {files.map((f) => (
          <li key={f.file}>
            <Badge
              label={`${f.file} · ${plural(f.requirements, "requirement")}`}
              {...(f.requirements > 0 ? { icon: Check } : {})}
            />
          </li>
        ))}
      </ul>
      {empty.length > 0 && (
        <p className="text-sm text-text-muted">
          No requirements in {empty.join(", ")}. {FORMAT_HELP}
        </p>
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
export function AddProject({ onScan }: { readonly onScan: (project: Project) => void }) {
  const p = useAddProject();
  return (
    <AddProjectView
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

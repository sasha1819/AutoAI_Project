export type FolderPurpose = "repo" | "prds";

/** The refusal for a path that was not picked in the dialog (scan:run, project:read-prds). */
export const NOT_PICKED = {
  ok: false,
  error: { code: "FOLDER_NOT_PICKED", message: "Choose the folder with the folder dialog first." },
} as const;

/**
 * The folders the user chose in the system dialog this session (ADR 0007: folders come from the dialog in main, the
 * screen only gets the chosen path). Main reads only these, so a compromised screen cannot name another folder
 * (the home folder, /etc) to be read and sent to the AI. Paths are compared exactly as the dialog returned them.
 */
export function createPickedFolders(): {
  readonly remember: (purpose: FolderPurpose, path: string) => void;
  readonly allows: (purpose: FolderPurpose, path: string) => boolean;
  /** A scan may read the repo and the PRD folder (or none) only when each was picked for that purpose. */
  readonly allowsScan: (input: {
    readonly repoRoot: string;
    readonly prdFolder: string | null;
  }) => boolean;
} {
  const picked: Record<FolderPurpose, Set<string>> = { repo: new Set(), prds: new Set() };
  const allows = (purpose: FolderPurpose, path: string) => picked[purpose].has(path);
  return {
    remember: (purpose, path) => {
      picked[purpose].add(path);
    },
    allows,
    allowsScan: ({ repoRoot, prdFolder }) =>
      allows("repo", repoRoot) && (prdFolder === null || allows("prds", prdFolder)),
  };
}

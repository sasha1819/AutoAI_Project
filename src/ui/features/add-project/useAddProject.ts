import { useCallback, useEffect, useRef, useState } from "react";
import type { PrdSummary } from "../../../contracts/project.ts";
import { BROKEN_MESSAGE, bridge } from "../../app/bridge.ts";
import { READ_PRDS_MESSAGE, SCAN_MESSAGE } from "./messages.ts";

/** What the chosen PRD folder holds, read before any scan (parsing only: no AI, no cost). */
export type PrdState =
  | { readonly kind: "none" }
  | { readonly kind: "reading" }
  | { readonly kind: "read"; readonly summary: PrdSummary }
  | { readonly kind: "no-files" }
  | { readonly kind: "failed"; readonly message: string };

/**
 * Whether Claude is connected: AI actions (scan) need a key; adding a project and reading PRDs do not. "missing"
 * carries why, in words: no key yet, or a saved key that cannot be read.
 */
export type AiState =
  | { readonly kind: "checking" }
  | { readonly kind: "connected" }
  | { readonly kind: "missing"; readonly message: string };

/** The folders chosen so far, kept by the app while the user visits Connect Claude and comes back. */
export type ChosenFolders = {
  readonly repoFolder: string | null;
  readonly prdFolder: string | null;
};

export type Project = { readonly repoRoot: string; readonly prdFolder: string | null };

export type AddProject = {
  readonly ai: AiState;
  readonly repoFolder: string | null;
  readonly prdFolder: string | null;
  readonly prds: PrdState;
  /** Which folder dialog is open. */
  readonly picking: "repo" | "prds" | null;
  /** A problem with the dialog itself (a bug), in words. */
  readonly notice: string | undefined;
  readonly chooseRepo: () => void;
  readonly choosePrds: () => void;
  /** The project to scan, as chosen; null until a project folder is chosen, or while the PRD folder is unusable. */
  readonly project: Project | null;
};

/** The Add project screen's one hook: the only code here that talks to main. */
export function useAddProject(
  initial: ChosenFolders,
  onFoldersChange: (folders: ChosenFolders) => void,
): AddProject {
  const [repoFolder, setRepoFolder] = useState<string | null>(initial.repoFolder);
  const [prdFolder, setPrdFolder] = useState<string | null>(initial.prdFolder);
  const [prds, setPrds] = useState<PrdState>({ kind: "none" });
  const [picking, setPicking] = useState<"repo" | "prds" | null>(null);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [ai, setAi] = useState<AiState>({ kind: "checking" });

  useEffect(() => {
    let live = true;
    const ask = async () => {
      let next: AiState;
      try {
        const reply = await bridge().invoke("ai:status", {});
        next = !reply.ok
          ? { kind: "missing", message: SCAN_MESSAGE[reply.error.code] }
          : reply.value.configured
            ? { kind: "connected" }
            : { kind: "missing", message: SCAN_MESSAGE.NO_KEY };
      } catch (e) {
        // A broken reply is a bug: said as one (the notice), and Scan stays off.
        console.error(e);
        if (live) setNotice(BROKEN_MESSAGE);
        next = { kind: "missing", message: SCAN_MESSAGE.NO_KEY };
      }
      if (live) setAi(next);
    };
    void ask();
    return () => {
      live = false;
    };
  }, []);

  const pick = useCallback(async (purpose: "repo" | "prds"): Promise<string | null> => {
    setPicking(purpose);
    setNotice(undefined);
    try {
      return (await bridge().invoke("project:pick-folder", { purpose })).path;
    } catch (e) {
      console.error(e);
      setNotice(BROKEN_MESSAGE);
      return null;
    } finally {
      setPicking(null);
    }
  }, []);

  const chooseRepo = useCallback(() => {
    void pick("repo").then((path) => {
      // Cancelled: the folder chosen before stays.
      if (path !== null) setRepoFolder(path);
    });
  }, [pick]);

  // One read at a time: the PRD folder's button ignores presses while it runs (busy).
  const readPrds = useCallback(async (folder: string) => {
    setPrds({ kind: "reading" });
    let next: PrdState;
    try {
      const reply = await bridge().invoke("project:read-prds", { prdFolder: folder });
      next = reply.ok
        ? { kind: "read", summary: reply.value }
        : reply.error.code === "NO_PRD_FILES"
          ? { kind: "no-files" }
          : { kind: "failed", message: READ_PRDS_MESSAGE[reply.error.code] };
    } catch (e) {
      console.error(e);
      next = { kind: "failed", message: BROKEN_MESSAGE };
    }
    setPrds(next);
  }, []);

  const choosePrds = useCallback(() => {
    void pick("prds").then((path) => {
      if (path === null) return;
      setPrdFolder(path);
      void readPrds(path);
    });
  }, [pick, readPrds]);

  // The folders as chosen: the scan service decides what "no PRD files" means. A folder that could not be read
  // blocks Scan until the user picks again, instead of quietly scanning without it.
  // The app keeps the folders across Connect Claude; main still allows them (picked this session).
  useEffect(() => {
    onFoldersChange({ repoFolder, prdFolder });
  }, [repoFolder, prdFolder, onFoldersChange]);
  // Coming back with a PRD folder: read it again (free, no AI) so the summary shows as before.
  const initialPrds = useRef(initial.prdFolder);
  useEffect(() => {
    if (initialPrds.current !== null) void readPrds(initialPrds.current);
  }, [readPrds]);

  const project =
    repoFolder === null || prds.kind === "reading" || prds.kind === "failed"
      ? null
      : { repoRoot: repoFolder, prdFolder };

  return { ai, repoFolder, prdFolder, prds, picking, notice, chooseRepo, choosePrds, project };
}

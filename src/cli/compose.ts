import { createFsRepoReader } from "../adapters/fs/fs-repo-reader.ts";
import { extractRequirements } from "../services/extract-requirements.ts";

/** Terminal composition root: the only place the CLI creates adapters and hands them to services. */
export function composeCli() {
  const repoReader = createFsRepoReader();
  return {
    extractRequirements: (input: { readonly prdFolder: string }) =>
      extractRequirements({ repoReader }, input),
  };
}

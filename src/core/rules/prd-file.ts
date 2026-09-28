import { isHiddenPath } from "./hidden-path.ts";

export const PRD_EXTENSIONS = ["md", "markdown", "txt"] as const;
const PRD_EXTENSION = new RegExp(`\\.(${PRD_EXTENSIONS.join("|")})$`, "i");

/** True when a folder-relative path is a PRD we can parse: markdown or plain text, and not hidden. */
export function isPrdFile(path: string): boolean {
  return PRD_EXTENSION.test(path) && !isHiddenPath(path);
}

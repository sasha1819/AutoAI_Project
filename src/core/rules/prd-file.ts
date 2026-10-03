import { isHiddenPath } from "./hidden-path.ts";
import { isVendoredPath } from "./vendored-path.ts";

export const PRD_EXTENSIONS = ["md", "markdown", "txt"] as const;
const PRD_EXTENSION = new RegExp(`\\.(${PRD_EXTENSIONS.join("|")})$`, "i");

/**
 * True when a folder-relative path is a PRD we can parse: markdown or plain text, not hidden, and not inside
 * dependencies or build output (a PRD folder chosen at the repo root must not sweep in node_modules' READMEs).
 */
export function isPrdFile(path: string): boolean {
  return PRD_EXTENSION.test(path) && !isHiddenPath(path) && !isVendoredPath(path);
}

// Dependencies and build output: copies of other people's code, or of our own. Neither describes the app.
const VENDORED_FOLDERS = new Set(["node_modules", "dist", "build", "out", "coverage", "vendor"]);

/** True when a "/"-separated path lies inside a dependency or build-output folder. */
export function isVendoredPath(path: string): boolean {
  return path.split("/").some((segment) => VENDORED_FOLDERS.has(segment));
}

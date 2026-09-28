/** True when any segment of a "/"-separated path starts with a dot (.git, .env, .cache, ...). */
export function isHiddenPath(path: string): boolean {
  return path.split("/").some((segment) => segment.startsWith("."));
}

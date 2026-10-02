import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

/** Where the screens come from: the bundled files, or the local dev server while developing. */
export type RendererSource =
  { readonly kind: "file"; readonly path: string } | { readonly kind: "dev"; readonly url: string };

/**
 * True for a URL that belongs to our own screens (ADR 0007: no remote content); everything else is refused, both
 * for navigation and for IPC calls. File URLs are compared as URLs, so Windows drive paths work too.
 */
export function isOwnUrl(url: string, source: RendererSource): boolean {
  if (url === "") return false;
  if (source.kind === "dev") return url.startsWith(`${new URL(source.url).origin}/`);
  return url.startsWith(`${pathToFileURL(dirname(source.path)).href}/`);
}

// Project text (PRDs, code, paths) goes inside the prompts' tags; escaping "<" means it can never close one of
// those tags and pose as instructions. Every prompt uses these two functions so the protection cannot drift.

/** Escapes text placed between a prompt's tags. */
export function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
}

/** Escapes text placed inside a tag's quoted attribute. */
export function escapeAttr(value: string): string {
  return escapeText(value).replaceAll('"', "&quot;");
}

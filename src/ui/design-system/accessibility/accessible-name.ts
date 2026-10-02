// Every control that is named by a prop (IconButton's label, Input's label) uses this, so the rule is the same
// everywhere: the name is required at the type level, and a blank one that only appears at runtime is a bug.

/** A string literal that is not empty: `label=""` does not compile. Wider strings are checked at runtime. */
export type NonEmpty<T extends string> = T extends "" ? never : T;

// Whitespace and invisible characters (soft hyphen, zero-width space/joiners, BOM) do not make a name.
const BLANK = /^[\s\u00AD\u180E\u200B-\u200D\u2060\uFEFF]*$/u;

/** True for text that shows or says nothing: empty, whitespace or invisible characters only. */
export function isBlank(text: string): boolean {
  return BLANK.test(text);
}

/** Throws when a control would render without an accessible name (a missing or blank label is a bug). */
export function assertAccessibleName(name: unknown, component: string): asserts name is string {
  if (typeof name !== "string" || isBlank(name)) {
    throw new Error(
      `${component} needs a non-empty label: it is the control's only accessible name`,
    );
  }
}

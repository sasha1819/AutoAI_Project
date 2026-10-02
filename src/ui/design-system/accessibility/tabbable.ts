// What the Tab key can reach, for primitives that manage focus themselves (Popover, Modal). One list, so they agree.
const NOT_SKIPPED = ':not([tabindex="-1"])';
const TABBABLE = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  '[contenteditable]:not([contenteditable="false"])',
  "[tabindex]",
]
  .map((s) => s + NOT_SKIPPED)
  .join(", ");

/** The controls under `root` that Tab reaches, in page order (not inside a hidden, inert or disabled group). */
export function tabbables(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (el) =>
      !el.matches(":disabled") && el.closest("[hidden], [inert], fieldset[disabled]") === null,
  );
}

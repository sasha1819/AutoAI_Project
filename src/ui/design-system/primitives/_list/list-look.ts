import { OVERLAY_SURFACE } from "../_overlay/index.ts";

// The look of an open list of choices, shared by Select and later menus, so they cannot drift apart. The
// mockups never show one open, so it is made of existing tokens: a surface panel with the overlay shadow, rows as
// tall as the sm controls, and the current row marked with the selected fill plus an inset focus-ring outline (a
// fill change alone would be too faint to follow by keyboard). Each component adds its own size and position.

export const LIST_PANEL = `${OVERLAY_SURFACE} overflow-hidden p-1`;

/** A row; the library marks the current one with data-highlighted and an unavailable one with data-disabled. */
export const LIST_ROW =
  "relative flex h-8 cursor-default select-none items-center rounded-control pl-8 pr-3 text-md text-text-primary " +
  "outline-none data-highlighted:bg-selected data-highlighted:inset-ring-1 data-highlighted:inset-ring-focus-ring " +
  "data-disabled:cursor-not-allowed data-disabled:opacity-disabled";

/** Where a row's check mark sits (neutral: violet is reserved for primary, AI and focus). */
export const LIST_ROW_INDICATOR = "absolute left-2.5 inline-flex text-text-primary";

/** Shown at the top and bottom of a list that scrolls: the scrollbar is hidden, so a list that just ends would not show there is more. */
export const LIST_SCROLL_BUTTON =
  "flex h-6 cursor-default items-center justify-center text-text-muted";

/** At most 10 rows are visible; longer lists scroll. */
export const LIST_MAX_HEIGHT = "max-h-80";

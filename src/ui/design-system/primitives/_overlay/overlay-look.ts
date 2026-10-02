// The surface every floating panel shares (a Select's list, a Popover, a Modal's dialog), so they cannot drift
// apart: the surface fill, the default edge, the card radius and the overlay shadow, above the page.
export const OVERLAY_SURFACE =
  "z-50 rounded-card border border-border-default bg-surface shadow-overlay";
